import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import {
  signInWithCredential,
  GoogleAuthProvider,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  Unsubscribe,
} from 'firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

import { auth, db } from '../config/firebase';
import { User, StudentDoc } from '../types';
import { generateSessionToken, sha256Base64 } from '../utils/crypto';
import {
  normalizeStudentBatchIds,
  resolveActiveBatchId,
  writeStoredActiveBatch,
  clearStoredActiveBatch,
} from '../utils/studentBatchUtils';

const STUDENT_SESSION_KEY = '@ka_student_session';

interface StoredSession {
  studentRecordId: string;
  sessionToken: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  loginWithUsername: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  loginGuestForExam: (params: {
    name: string;
    email: string;
    testId: string;
    passcode?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  setActiveBatch: (batchId: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getDeviceDescription(): string {
  const brand = Device.brand || 'Android';
  const model = Device.modelName || 'Device';
  const osVer = Device.osVersion || Platform.Version;
  return `${brand} ${model} (Android ${osVer})`;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isLoggingInRef = useRef(false);
  const sessionListenerUnsubRef = useRef<Unsubscribe | null>(null);

  // Configure GoogleSignin
  useEffect(() => {
    try {
      GoogleSignin.configure({
        webClientId:
          process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
          '379946263512-qsdfrn6orn9oq266j7o16jeahr26ruq5.apps.googleusercontent.com',
        offlineAccess: false,
      });
    } catch (e) {
      console.warn('[AUTH] GoogleSignin configure error:', e);
    }
  }, []);

  /**
   * Writes the unique session token to local storage and updates Firestore students doc
   */
  const writeStudentSession = async (studentRecordId: string): Promise<string> => {
    const sessionToken = generateSessionToken();
    const stored: StoredSession = { studentRecordId, sessionToken };
    await AsyncStorage.setItem(STUDENT_SESSION_KEY, JSON.stringify(stored));

    try {
      await updateDoc(doc(db, 'students', studentRecordId), {
        activeSessionToken: sessionToken,
        activeDevice: getDeviceDescription(),
        activeDeviceLoginAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[AUTH] Error updating active session in Firestore:', err);
    }
    return sessionToken;
  };

  /**
   * Sets up real-time listener for single-device restriction on the student doc
   */
  const attachSessionListener = (studentRecordId: string) => {
    if (sessionListenerUnsubRef.current) {
      sessionListenerUnsubRef.current();
      sessionListenerUnsubRef.current = null;
    }

    const unsub = onSnapshot(doc(db, 'students', studentRecordId), async (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data() as StudentDoc;
      const remoteToken = data.activeSessionToken;

      try {
        const localRaw = await AsyncStorage.getItem(STUDENT_SESSION_KEY);
        if (localRaw) {
          const { sessionToken: localToken } = JSON.parse(localRaw) as StoredSession;
          if (remoteToken && localToken && remoteToken !== localToken) {
            console.warn('[AUTH] Active session token mismatch! Logging out.');
            await AsyncStorage.removeItem(STUDENT_SESSION_KEY);
            await signOut(auth);
            setUser(null);
            Alert.alert(
              'Signed Out',
              "You were signed out because your account was logged in on another device. Contact your admin if this wasn't you."
            );
          }
        }
      } catch (err) {
        console.error('[AUTH] Session verification error:', err);
      }
    });

    sessionListenerUnsubRef.current = unsub;
  };

  /**
   * Hydrates the User profile from Firestore users and students collections
   */
  const fetchUserData = async (firebaseUser: FirebaseUser): Promise<User | null> => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);
      const userData = userDocSnap.exists() ? userDocSnap.data() : null;

      if (!userData) {
        return null;
      }

      let studentRecordId = userData.studentRecordId;
      let studentData: StudentDoc | null = null;

      if (studentRecordId) {
        const studentSnap = await getDoc(doc(db, 'students', studentRecordId));
        if (studentSnap.exists()) {
          studentData = studentSnap.data() as StudentDoc;
        }
      } else if (firebaseUser.email) {
        const q = query(
          collection(db, 'students'),
          where('email', '==', firebaseUser.email.trim().toLowerCase())
        );
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          studentRecordId = qSnap.docs[0].id;
          studentData = qSnap.docs[0].data() as StudentDoc;
        }
      }

      const batchIds = studentData ? normalizeStudentBatchIds(studentData) : (userData.batchIds || []);
      const activeBatchId = studentRecordId
        ? await resolveActiveBatchId({
            batchIds,
            studentRecordId,
            preferredFromUserDoc: userData.batchId,
          })
        : userData.batchId;

      if (studentRecordId && activeBatchId) {
        await writeStoredActiveBatch(studentRecordId, activeBatchId);
      }

      // Attach single device listener for enrolled students
      if (studentRecordId && !firebaseUser.isAnonymous) {
        attachSessionListener(studentRecordId);
      }

      return {
        id: firebaseUser.uid,
        email: userData.email || firebaseUser.email || '',
        name: studentData?.name?.trim() || userData.name || 'Student',
        role: 'student',
        studentId: studentData?.studentId || userData.studentId,
        batchId: activeBatchId,
        batchIds: batchIds.length ? batchIds : undefined,
        studentRecordId,
        photoURL: studentData?.photoURL || userData.photoURL || firebaseUser.photoURL || undefined,
        isGuestExamParticipant: userData.isGuestExamParticipant === true,
        guestExamTestId: userData.guestExamTestId,
      };
    } catch (err) {
      console.error('[AUTH] fetchUserData error:', err);
      return null;
    }
  };

  // Auth State Listener
  useEffect(() => {
    let cancelled = false;

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;
      if (isLoggingInRef.current) return;

      if (firebaseUser) {
        const u = await fetchUserData(firebaseUser);
        if (!cancelled) {
          setUser(u);
          setLoading(false);
        }
      } else {
        if (sessionListenerUnsubRef.current) {
          sessionListenerUnsubRef.current();
          sessionListenerUnsubRef.current = null;
        }
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsub();
      if (sessionListenerUnsubRef.current) {
        sessionListenerUnsubRef.current();
      }
    };
  }, []);

  /**
   * 1. Google Sign-In Flow
   */
  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    isLoggingInRef.current = true;
    try {
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = signInResult.data?.idToken || (signInResult as any).idToken;

      if (!idToken) {
        return { success: false, error: 'Could not obtain Google authentication token.' };
      }

      const googleCredential = GoogleAuthProvider.credential(idToken);
      const authResult = await signInWithCredential(auth, googleCredential);
      const email = authResult.user.email?.trim().toLowerCase();

      if (!email) {
        await signOut(auth);
        return { success: false, error: 'No email associated with this Google Account.' };
      }

      // Check registration in students collection
      const studentSnap = await getDocs(
        query(collection(db, 'students'), where('email', '==', email))
      );

      if (studentSnap.empty) {
        await signOut(auth);
        return {
          success: false,
          error: 'Your account is not registered by the administrator.',
        };
      }

      const studentDocSnap = studentSnap.docs[0];
      const studentRecordId = studentDocSnap.id;
      const studentData = studentDocSnap.data() as StudentDoc;

      if (studentData.status === 'inactive') {
        await signOut(auth);
        return { success: false, error: 'Your account is inactive. Contact your admin.' };
      }

      const batchIds = normalizeStudentBatchIds(studentData);
      const activeBatchId = await resolveActiveBatchId({
        batchIds,
        studentRecordId,
        preferredFromUserDoc: studentData.batchId,
      });

      if (activeBatchId) {
        await writeStoredActiveBatch(studentRecordId, activeBatchId);
      }

      // Single-device session update
      await writeStudentSession(studentRecordId);
      attachSessionListener(studentRecordId);

      const userName = studentData.name?.trim() || authResult.user.displayName || 'Student';
      const photoURL = studentData.photoURL || authResult.user.photoURL || undefined;

      // Update users/{uid}
      await setDoc(
        doc(db, 'users', authResult.user.uid),
        {
          role: 'student',
          name: userName,
          email,
          studentId: studentData.studentId || null,
          batchId: activeBatchId ?? null,
          batchIds,
          studentRecordId,
          isGuestExamParticipant: false,
          guestExamTestId: null,
          ...(photoURL ? { photoURL } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const studentUser: User = {
        id: authResult.user.uid,
        email,
        name: userName,
        role: 'student',
        studentId: studentData.studentId,
        batchId: activeBatchId,
        batchIds: batchIds.length ? batchIds : undefined,
        studentRecordId,
        photoURL,
        isGuestExamParticipant: false,
      };

      setUser(studentUser);
      return { success: true };
    } catch (err: any) {
      console.error('[AUTH] Google Sign-In error:', err);
      const msg = err?.message || String(err);
      if (msg.includes('DEVELOPER_ERROR') || err?.code === '10' || err?.code === 10) {
        return {
          success: false,
          error:
            'Google Sign-In configuration error (DEVELOPER_ERROR): The app signing SHA-1 fingerprint needs to be added to Firebase Console under Project Settings -> Android apps.',
        };
      }
      return {
        success: false,
        error: err?.message || 'Google sign-in failed. Please try again.',
      };
    } finally {
      isLoggingInRef.current = false;
    }
  };

  /**
   * 2. Username & Password Login
   */
  const loginWithUsername = async (
    usernameInput: string,
    passwordInput: string
  ): Promise<{ success: boolean; error?: string }> => {
    const rawInput = usernameInput.trim();
    const cleanInput = rawInput.toLowerCase();
    const password = passwordInput.trim();

    if (!rawInput || !password) {
      return { success: false, error: 'Please enter both username and password.' };
    }

    isLoggingInRef.current = true;
    try {
      // 1. Check portalUsername
      let studentSnap = await getDocs(
        query(collection(db, 'students'), where('portalUsername', '==', cleanInput))
      );

      // 2. Check email
      if (studentSnap.empty) {
        studentSnap = await getDocs(
          query(collection(db, 'students'), where('email', '==', cleanInput))
        );
      }

      // 3. Check studentId
      if (studentSnap.empty) {
        studentSnap = await getDocs(
          query(collection(db, 'students'), where('studentId', '==', rawInput))
        );
      }

      if (studentSnap.empty) {
        return { success: false, error: 'Invalid username or password.' };
      }

      const studentDocRef = studentSnap.docs[0];
      const studentRecordId = studentDocRef.id;
      const studentData = studentDocRef.data() as StudentDoc;

      if (studentData.status === 'inactive') {
        return { success: false, error: 'Your account is inactive. Contact your admin.' };
      }

      const storedPassword = String(studentData.portalPassword || '').trim();
      if (!storedPassword || storedPassword !== password) {
        return { success: false, error: 'Invalid username or password.' };
      }

      // Authenticate with Firebase Auth anonymously
      let currentAuthUser = auth.currentUser;
      if (!currentAuthUser) {
        const cred = await signInAnonymously(auth);
        currentAuthUser = cred.user;
      }

      const signedInEmail = (studentData.email || '').trim().toLowerCase();
      const batchIds = normalizeStudentBatchIds(studentData);
      const activeBatchId = await resolveActiveBatchId({
        batchIds,
        studentRecordId,
        preferredFromUserDoc: studentData.batchId,
      });

      if (activeBatchId) {
        await writeStoredActiveBatch(studentRecordId, activeBatchId);
      }

      const userName = studentData.name?.trim() || 'Student';
      const photoURL = studentData.photoURL?.trim() || undefined;

      // Update user doc in Firestore
      await setDoc(
        doc(db, 'users', currentAuthUser.uid),
        {
          role: 'student',
          name: userName,
          email: signedInEmail,
          studentId: studentData.studentId || null,
          batchId: activeBatchId ?? null,
          batchIds,
          studentRecordId,
          isGuestExamParticipant: false,
          guestExamTestId: null,
          ...(photoURL ? { photoURL } : {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await writeStudentSession(studentRecordId);
      attachSessionListener(studentRecordId);

      const studentUser: User = {
        id: currentAuthUser.uid,
        email: signedInEmail,
        name: userName,
        role: 'student',
        studentId: studentData.studentId,
        batchId: activeBatchId,
        batchIds: batchIds.length ? batchIds : undefined,
        studentRecordId,
        photoURL,
        isGuestExamParticipant: false,
      };

      setUser(studentUser);
      return { success: true };
    } catch (err: any) {
      console.error('[AUTH] Username login error:', err);
      return {
        success: false,
        error: err?.message || 'Login failed. Please check your credentials.',
      };
    } finally {
      isLoggingInRef.current = false;
    }
  };

  /**
   * 3. Guest Exam Login
   */
  const loginGuestForExam = async (params: {
    name: string;
    email: string;
    testId: string;
    passcode?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    const name = params.name.trim();
    const email = params.email.trim().toLowerCase();
    const testId = params.testId.trim();

    if (!name) return { success: false, error: 'Please enter your name.' };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: 'Please enter a valid email address.' };
    }
    if (!testId) return { success: false, error: 'Test not specified.' };

    isLoggingInRef.current = true;
    try {
      // Verify passcode if test requires one
      const testDocSnap = await getDoc(doc(db, 'examTests', testId));
      if (!testDocSnap.exists()) {
        return { success: false, error: 'Examination not found.' };
      }
      const testData = testDocSnap.data();

      if (testData.accessPasswordHash) {
        if (!params.passcode) {
          return { success: false, error: 'Please enter the examination passcode.' };
        }
        const enteredHash = await sha256Base64(params.passcode.trim());
        if (enteredHash !== testData.accessPasswordHash) {
          return { success: false, error: 'Incorrect examination passcode.' };
        }
      }

      if (auth.currentUser) {
        await signOut(auth);
      }

      const cred = await signInAnonymously(auth);
      const uid = cred.user.uid;

      // Check if student with this email is already registered
      const guestStudentSnap = await getDocs(
        query(collection(db, 'students'), where('email', '==', email))
      );
      const guestStudent = guestStudentSnap.empty ? null : guestStudentSnap.docs[0];
      const guestBatchIds = guestStudent ? normalizeStudentBatchIds(guestStudent.data() as any) : [];

      await setDoc(
        doc(db, 'users', uid),
        {
          role: 'student',
          name: guestStudent?.data()?.name?.trim() || name,
          email,
          isGuestExamParticipant: true,
          guestExamTestId: testId,
          ...(guestStudent
            ? {
                studentRecordId: guestStudent.id,
                studentId: guestStudent.data()?.studentId ?? null,
                batchId: guestBatchIds[0] ?? guestStudent.data()?.batchId ?? null,
                batchIds: guestBatchIds,
                ...(guestStudent.data()?.photoURL ? { photoURL: guestStudent.data()?.photoURL } : {}),
              }
            : {}),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Save to examTests/{testId}/guestProfiles/{uid}
      await setDoc(
        doc(db, 'examTests', testId, 'guestProfiles', uid),
        {
          uid,
          testId,
          name,
          email,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      const guestUser: User = {
        id: uid,
        email,
        name: guestStudent?.data()?.name?.trim() || name,
        role: 'student',
        studentId: guestStudent?.data()?.studentId,
        batchId: guestBatchIds[0] || undefined,
        batchIds: guestBatchIds.length ? guestBatchIds : undefined,
        studentRecordId: guestStudent?.id,
        isGuestExamParticipant: true,
        guestExamTestId: testId,
      };

      setUser(guestUser);
      return { success: true };
    } catch (err: any) {
      console.error('[AUTH] Guest exam login error:', err);
      return {
        success: false,
        error: err?.message || 'Could not join exam as guest.',
      };
    } finally {
      isLoggingInRef.current = false;
    }
  };

  /**
   * Switch active batch for multi-batch students
   */
  const setActiveBatch = async (batchId: string): Promise<void> => {
    if (!user) return;
    try {
      if (user.studentRecordId) {
        await writeStoredActiveBatch(user.studentRecordId, batchId);
      }
      await updateDoc(doc(db, 'users', user.id), {
        batchId,
        updatedAt: new Date().toISOString(),
      });
      setUser((prev) => (prev ? { ...prev, batchId } : null));
    } catch (err) {
      console.error('[AUTH] setActiveBatch error:', err);
    }
  };

  /**
   * Logout student
   */
  const logout = async (): Promise<void> => {
    try {
      if (sessionListenerUnsubRef.current) {
        sessionListenerUnsubRef.current();
        sessionListenerUnsubRef.current = null;
      }
      await AsyncStorage.removeItem(STUDENT_SESSION_KEY);
      if (user?.studentRecordId) {
        await clearStoredActiveBatch(user.studentRecordId);
      }
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error('[AUTH] Logout error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        loginWithGoogle,
        loginWithUsername,
        loginGuestForExam,
        setActiveBatch,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

