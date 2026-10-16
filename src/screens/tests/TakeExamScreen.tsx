import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Clock,
  AlertTriangle,
  Award,
  CheckCircle,
  HelpCircle,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Flag,
  Check,
  Grid,
  Shield,
  Layers,
  X,
} from 'lucide-react-native';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ExamAttempt,
  ExamPart,
  ExamQuestion,
  ExamQuestionPrivate,
  ExamTest,
  PaletteStatus,
  RootStackParamList,
} from '../../types';
import { enableScreenSecurity, disableScreenSecurity } from '../../services/security';
import { MathFormulaView } from '../../components/MathFormulaView';
import { Keypad } from '../../components/Keypad';
import { QuestionPaletteModal } from '../../components/QuestionPaletteModal';
import { ImageZoomModal } from '../../components/ImageZoomModal';
import { sha256Base64 } from '../../utils/crypto';

type Props = NativeStackScreenProps<RootStackParamList, 'TakeExam'>;

function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export const TakeExamScreen: React.FC<Props> = ({ navigation, route }) => {
  const { testId } = route.params;
  const { user } = useAuth();

  // Test metadata & questions
  const [test, setTest] = useState<ExamTest | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [keys, setKeys] = useState<ExamQuestionPrivate[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Instructions & Access Passcode verification
  const [showInstructions, setShowInstructions] = useState<boolean>(true);
  const [agreedInstructions, setAgreedInstructions] = useState<boolean>(false);
  const [passcodeInput, setPasscodeInput] = useState<string>('');
  const [passcodeError, setPasscodeError] = useState<string | null>(null);

  // Exam Attempt state
  const [attemptStartedAt, setAttemptStartedAt] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<'in_progress' | 'submitted' | null>(null);
  const [hardEndAtMs, setHardEndAtMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);

  // Current question navigation & responses
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [markedForReview, setMarkedForReview] = useState<string[]>([]);
  const [visited, setVisited] = useState<Record<string, boolean>>({});

  // Modals & Anti-Cheat
  const [paletteVisible, setPaletteVisible] = useState<boolean>(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [confirmSubmitVisible, setConfirmSubmitVisible] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Anti-Cheat strikes counter
  const [strikes, setStrikes] = useState<number>(0);
  const [strikeModalVisible, setStrikeModalVisible] = useState<boolean>(false);

  // Ref for timer & autosave
  const timerIntervalRef = useRef<any>(null);
  const autosaveIntervalRef = useRef<any>(null);
  const isSubmittingRef = useRef<boolean>(false);

  // 1. Enable Android FLAG_SECURE to prevent screenshots
  useEffect(() => {
    enableScreenSecurity('cbt-engine');
    return () => {
      disableScreenSecurity('cbt-engine');
    };
  }, []);

  // 2. Fetch Test, Questions and Attempt
  useEffect(() => {
    let cancelled = false;

    const loadExam = async () => {
      if (!testId || !user?.id) return;
      setLoading(true);
      try {
        // Fetch test doc
        const testSnap = await getDoc(doc(db, 'examTests', testId));
        if (!testSnap.exists()) {
          Alert.alert('Error', 'Examination not found.');
          navigation.goBack();
          return;
        }
        const testData = { id: testSnap.id, ...(testSnap.data() as any) } as ExamTest;
        if (!cancelled) setTest(testData);

        // Fetch questions from subcollection
        const qSnap = await getDocs(
          collection(db, 'examTests', testId, 'questionsPublic')
        );
        let qList: ExamQuestion[] = qSnap.docs.map((d) => ({
          id: d.id,
          questionNo: d.data().questionNo ?? 1,
          text: d.data().text || '',
          imageUrl: d.data().imageUrl,
          options: d.data().options || [],
          type: d.data().type || 'single',
          marks: d.data().marks,
          negativeMarks: d.data().negativeMarks,
          partId: d.data().partId,
        }));

        qList.sort((a, b) => (a.questionNo ?? 0) - (b.questionNo ?? 0));
        if (!cancelled) setQuestions(qList);

        // Check if student already started or submitted
        const attemptSnap = await getDoc(
          doc(db, 'examTests', testId, 'attempts', user.id)
        );

        if (attemptSnap.exists()) {
          const attemptData = attemptSnap.data() as ExamAttempt;
          if (attemptData.status === 'submitted') {
            navigation.replace('ExamResult', { testId });
            return;
          }

          if (attemptData.status === 'in_progress') {
            setShowInstructions(false);
            setAttemptStatus('in_progress');
            setAttemptStartedAt(attemptData.startedAt);
            setAnswers(attemptData.answers || {});
            setMarkedForReview(attemptData.markedForReview || []);
            setStrikes(attemptData.strikes || 0);

            const durationMs = (testData.durationMinutes || 60) * 60 * 1000;
            const startMs = new Date(attemptData.startedAt).getTime();
            const endMs = startMs + durationMs;
            setHardEndAtMs(endMs);
          }
        }
      } catch (err) {
        console.error('[CBT] Error loading test:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadExam();

    return () => {
      cancelled = true;
    };
  }, [testId, user?.id]);

  // 3. Timer Countdown
  useEffect(() => {
    if (!hardEndAtMs || attemptStatus !== 'in_progress') return;

    const tick = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((hardEndAtMs - now) / 1000));
      setRemainingSeconds(diff);

      if (diff <= 0 && !isSubmittingRef.current) {
        // Auto-submit test immediately on expiry
        handleAutoSubmit('Time has expired! Submitting your test automatically.');
      }
    };

    tick();
    timerIntervalRef.current = setInterval(tick, 1000);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [hardEndAtMs, attemptStatus]);

  // 4. Mark current question as visited
  const currentQuestion = questions[currentIndex];
  useEffect(() => {
    if (currentQuestion?.id) {
      setVisited((prev) => ({ ...prev, [currentQuestion.id]: true }));
    }
  }, [currentQuestion?.id]);

  // 5. Anti-Cheat AppState Proctoring Monitor
  useEffect(() => {
    if (attemptStatus !== 'in_progress') return;

    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState.match(/inactive|background/)) {
        setStrikes((prev) => {
          const next = prev + 1;
          setStrikeModalVisible(true);

          // Save strike to Firestore
          if (user?.id) {
            updateDoc(doc(db, 'examTests', testId, 'attempts', user.id), {
              strikes: next,
            }).catch(() => {});
          }

          if (next >= 3 && !isSubmittingRef.current) {
            handleAutoSubmit(
              'Exam force-submitted: You exceeded the limit of leaving or backgrounding the exam screen.'
            );
          }
          return next;
        });
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [attemptStatus, testId, user?.id]);

  // 6. Autosave every 30 seconds & on answer changes
  const saveProgressToFirestore = async (
    currentAnswers: Record<string, any>,
    currentMarked: string[]
  ) => {
    if (!user?.id || attemptStatus !== 'in_progress') return;
    try {
      // Local backup for offline resilience
      await AsyncStorage.setItem(
        `@ka_exam_answers_${testId}`,
        JSON.stringify(currentAnswers)
      );

      await setDoc(
        doc(db, 'examTests', testId, 'attempts', user.id),
        {
          answers: currentAnswers,
          markedForReview: currentMarked,
          lastSavedAt: new Date().toISOString(),
          lastSavedAtServer: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[CBT] Autosave warning:', err);
    }
  };

  useEffect(() => {
    if (attemptStatus !== 'in_progress') return;

    autosaveIntervalRef.current = setInterval(() => {
      saveProgressToFirestore(answers, markedForReview);
    }, 30000);

    return () => {
      if (autosaveIntervalRef.current) clearInterval(autosaveIntervalRef.current);
    };
  }, [answers, markedForReview, attemptStatus]);

  // 7. Begin Exam Handler
  const handleBeginExam = async () => {
    if (!agreedInstructions) {
      Alert.alert('Instructions', 'Please check the box confirming you have read all instructions.');
      return;
    }

    // Verify passcode if test is password protected
    if (test?.accessPasswordHash) {
      if (!passcodeInput.trim()) {
        setPasscodeError('Please enter the examination passcode.');
        return;
      }
      const hash = await sha256Base64(passcodeInput.trim());
      if (hash !== test.accessPasswordHash) {
        setPasscodeError('Incorrect exam passcode.');
        return;
      }
    }

    if (!user?.id || !test) return;

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      const durationMs = (test.durationMinutes || 60) * 60 * 1000;
      const endMs = Date.now() + durationMs;

      const initialAnswers: Record<string, any> = {};
      questions.forEach((q) => (initialAnswers[q.id] = null));

      await setDoc(
        doc(db, 'examTests', testId, 'attempts', user.id),
        {
          uid: user.id,
          testId,
          batchId: user.batchId || test.batchId || null,
          studentRecordId: user.studentRecordId || null,
          participantName: user.name || 'Student',
          participantEmail: user.email || null,
          isGuest: user.isGuestExamParticipant === true,
          startedAt: nowIso,
          hardEndAt: new Date(endMs).toISOString(),
          lastSavedAt: nowIso,
          status: 'in_progress',
          answers: initialAnswers,
          questionIds: questions.map((q) => q.id),
          markedForReview: [],
          strikes: 0,
        },
        { merge: true }
      );

      setAttemptStartedAt(nowIso);
      setHardEndAtMs(endMs);
      setAttemptStatus('in_progress');
      setAnswers(initialAnswers);
      setShowInstructions(false);
    } catch (err) {
      console.error('[CBT] Error starting attempt:', err);
      Alert.alert('Error', 'Could not begin exam. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // 8. Auto-submit handler
  const handleAutoSubmit = async (reason: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    Alert.alert('Exam Submitted', reason);
    await performSubmission();
  };

  // 9. Scoring and Submit Examination
  const performSubmission = async () => {
    if (!user?.id || !test) return;
    setSubmitting(true);

    try {
      // Fetch private answer keys to calculate score
      let privateKeys = keys;
      if (!privateKeys) {
        const keySnap = await getDocs(
          collection(db, 'examTests', testId, 'questionsPrivate')
        );
        privateKeys = keySnap.docs.map((d) => ({
          id: d.id,
          correctIndex: d.data().correctIndex,
          numericalAnswer: d.data().numericalAnswer,
        }));
      }

      const keyMap = new Map<string, ExamQuestionPrivate>();
      privateKeys.forEach((k) => keyMap.set(k.id, k));

      let totalScore = 0;
      let maxScore = 0;
      let correctCount = 0;
      let wrongCount = 0;
      let unansweredCount = 0;

      const defaultMarks = test.defaultMarksPerQuestion || 4;
      const negativeMarks = test.negativeMarkPerWrong ?? 1;

      questions.forEach((q) => {
        const qMarks = q.marks ?? defaultMarks;
        const qNeg = q.negativeMarks ?? negativeMarks;
        maxScore += qMarks;

        const candidateAnswer = answers[q.id];
        const privateKey = keyMap.get(q.id);

        if (candidateAnswer === null || candidateAnswer === undefined || candidateAnswer === '') {
          unansweredCount++;
          return;
        }

        let isCorrect = false;
        if (q.type === 'numerical') {
          const expected = String(privateKey?.numericalAnswer ?? '').trim();
          const given = String(candidateAnswer).trim();
          isCorrect = expected === given;
        } else {
          isCorrect = candidateAnswer === privateKey?.correctIndex;
        }

        if (isCorrect) {
          totalScore += qMarks;
          correctCount++;
        } else {
          totalScore -= qNeg;
          wrongCount++;
        }
      });

      // Update attempt in Firestore
      await updateDoc(doc(db, 'examTests', testId, 'attempts', user.id), {
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        score: totalScore,
        maxScore,
        correctCount,
        wrongCount,
        unansweredCount,
        answers,
        markedForReview,
      });

      // Clean local storage cache
      await AsyncStorage.removeItem(`@ka_exam_answers_${testId}`);

      navigation.replace('ExamResult', { testId });
    } catch (err) {
      console.error('[CBT] Submission error:', err);
      Alert.alert('Error', 'Could not submit exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Status mapping for Question Palette
  const paletteStatus = useMemo(() => {
    const statusMap: Record<string, PaletteStatus> = {};
    questions.forEach((q) => {
      const isVisited = !!visited[q.id];
      const hasAnswer = answers[q.id] !== null && answers[q.id] !== undefined && answers[q.id] !== '';
      const isMarked = markedForReview.includes(q.id);

      if (!isVisited) statusMap[q.id] = 'not_visited';
      else if (isMarked && hasAnswer) statusMap[q.id] = 'answered_marked';
      else if (isMarked) statusMap[q.id] = 'marked_for_review';
      else statusMap[q.id] = hasAnswer ? 'answered' : 'not_answered';
    });
    return statusMap;
  }, [questions, visited, answers, markedForReview]);

  // Section / Part grouping
  const currentPart = useMemo(() => {
    if (!test?.parts?.length || !currentQuestion?.partId) return null;
    return test.parts.find((p) => p.id === currentQuestion.partId) || null;
  }, [test, currentQuestion]);

  // Response Selection Actions
  const handleSelectOption = (index: number) => {
    const newAnswers = { ...answers, [currentQuestion.id]: index };
    setAnswers(newAnswers);
    saveProgressToFirestore(newAnswers, markedForReview);
  };

  const handleNumericalInput = (val: string) => {
    const newAnswers = { ...answers, [currentQuestion.id]: val };
    setAnswers(newAnswers);
    saveProgressToFirestore(newAnswers, markedForReview);
  };

  const handleClearResponse = () => {
    const newAnswers = { ...answers, [currentQuestion.id]: null };
    setAnswers(newAnswers);
    saveProgressToFirestore(newAnswers, markedForReview);
  };

  const handleSaveAndNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleMarkForReviewAndNext = () => {
    if (!markedForReview.includes(currentQuestion.id)) {
      const nextMarked = [...markedForReview, currentQuestion.id];
      setMarkedForReview(nextMarked);
      saveProgressToFirestore(answers, nextMarked);
    }
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  // RENDER: Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading CBT examination engine...</Text>
      </SafeAreaView>
    );
  }

  // RENDER: Instructions Screen
  if (showInstructions) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.instructionsHeader}>
          <Text style={styles.instructionsHeaderTitle} numberOfLines={1}>
            {test?.title || 'Examination Instructions'}
          </Text>
        </View>

        <ScrollView style={styles.instructionsContent} contentContainerStyle={styles.instructionsScroll}>
          {/* Institute Official Banner Header */}
          <View style={styles.instructionsBannerCard}>
            <Image
              source={require('../../../assets/banner.jpeg')}
              style={styles.instructionsBannerImage}
              resizeMode="contain"
            />
          </View>

          {/* Test Specs Card */}
          <View style={styles.testMetaCard}>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Clock size={16} color="#4F46E5" />
                <Text style={styles.metaLabel}>Duration:</Text>
                <Text style={styles.metaValue}>{test?.durationMinutes} Minutes</Text>
              </View>
              <View style={styles.metaItem}>
                <Award size={16} color="#4F46E5" />
                <Text style={styles.metaLabel}>Total Marks:</Text>
                <Text style={styles.metaValue}>{test?.totalMarks || 0}</Text>
              </View>
            </View>

            <View style={styles.markingCard}>
              <Text style={styles.markingTitle}>Scoring System:</Text>
              <Text style={styles.markingText}>
                • Correct Answer: +{test?.defaultMarksPerQuestion || 4} Marks
              </Text>
              <Text style={styles.markingText}>
                • Negative Marking: -{test?.negativeMarkPerWrong ?? 1} Mark for incorrect answer
              </Text>
              <Text style={styles.markingText}>
                • Unattempted: 0 Marks
              </Text>
            </View>
          </View>

          {/* Question Palette Status Legend */}
          <View style={styles.legendCard}>
            <Text style={styles.legendCardTitle}>Question Palette Status Guide:</Text>
            <View style={styles.legendGuideRow}>
              <View style={[styles.legendDot, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1 }]} />
              <Text style={styles.legendGuideText}>⚪ Not Visited: Question has not been opened yet</Text>
            </View>
            <View style={styles.legendGuideRow}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.legendGuideText}>🔴 Not Answered: Visited but no answer selected</Text>
            </View>
            <View style={styles.legendGuideRow}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={styles.legendGuideText}>🟢 Answered: Answer has been selected</Text>
            </View>
            <View style={styles.legendGuideRow}>
              <View style={[styles.legendDot, { backgroundColor: '#8B5CF6' }]} />
              <Text style={styles.legendGuideText}>🟣 Marked for Review: Flagged for review without answer</Text>
            </View>
            <View style={styles.legendGuideRow}>
              <View style={[styles.legendDot, { backgroundColor: '#6366F1' }]} />
              <Text style={styles.legendGuideText}>🟣🟢 Answered & Marked: Answered and flagged for review</Text>
            </View>
          </View>

          {/* Strict Rules */}
          <View style={styles.rulesCard}>
            <View style={styles.rulesHeader}>
              <AlertTriangle size={18} color="#D97706" />
              <Text style={styles.rulesTitle}>Strict Lockdown Rules:</Text>
            </View>
            <Text style={styles.rulesItem}>1. Leaving the app, switching apps, or opening notifications will trigger an anti-cheat strike.</Text>
            <Text style={styles.rulesItem}>2. Exceeding 3 strikes will automatically submit your examination.</Text>
            <Text style={styles.rulesItem}>3. When the countdown reaches 00:00, the exam auto-submits instantly.</Text>
            <Text style={styles.rulesItem}>4. Answers are securely backed up on our servers in real time.</Text>
          </View>

          {/* Passcode entry if protected */}
          {test?.accessPasswordHash ? (
            <View style={styles.passcodeSection}>
              <Text style={styles.passcodeLabel}>Examination Passcode:</Text>
              <TextInput
                style={styles.passcodeInput}
                placeholder="Enter access passcode"
                placeholderTextColor="#94A3B8"
                value={passcodeInput}
                onChangeText={(t: string) => {
                  setPasscodeInput(t);
                  setPasscodeError(null);
                }}
                secureTextEntry
              />
              {passcodeError ? (
                <Text style={styles.passcodeErrorText}>{passcodeError}</Text>
              ) : null}
            </View>
          ) : null}

          {/* Agreement Checkbox */}
          <TouchableOpacity
            style={styles.agreementRow}
            onPress={() => setAgreedInstructions(!agreedInstructions)}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, agreedInstructions && styles.checkboxActive]}>
              {agreedInstructions ? <Check size={14} color="#FFFFFF" /> : null}
            </View>
            <Text style={styles.agreementText}>
              I have read and understood all instructions. I agree not to switch apps or use unfair means during this examination.
            </Text>
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.instructionsFooter}>
          <TouchableOpacity
            style={[styles.beginBtn, !agreedInstructions && styles.beginBtnDisabled]}
            onPress={handleBeginExam}
            disabled={!agreedInstructions}
            activeOpacity={0.8}
          >
            <Text style={styles.beginBtnText}>I Am Ready to Begin</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // RENDER: Exam Interface (Full-Screen Lockdown)
  const isTimeCritical = remainingSeconds < 300; // < 5 minutes
  const selectedAnswer = answers[currentQuestion?.id];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Lockdown Header */}
      <View style={styles.examHeader}>
        <View style={styles.examHeaderInfo}>
          <Text style={styles.examHeaderTitle} numberOfLines={1}>
            {test?.title}
          </Text>
          {currentPart ? (
            <Text style={styles.partLabel}>{currentPart.name}</Text>
          ) : null}
        </View>

        {/* Remaining Time Countdown */}
        <View style={[styles.timerBadge, isTimeCritical && styles.timerBadgeCritical]}>
          <Clock size={16} color={isTimeCritical ? '#EF4444' : '#4F46E5'} />
          <Text style={[styles.timerText, isTimeCritical && styles.timerTextCritical]}>
            {formatCountdown(remainingSeconds)}
          </Text>
        </View>

        {/* Question Palette Button */}
        <TouchableOpacity
          style={styles.paletteTriggerBtn}
          onPress={() => setPaletteVisible(true)}
          activeOpacity={0.7}
        >
          <Grid size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Question Details Bar */}
      <View style={styles.questionBar}>
        <Text style={styles.questionNoText}>
          Question {currentIndex + 1} of {questions.length}
        </Text>
        <View style={styles.marksBadge}>
          <Text style={styles.marksBadgeText}>
            +{currentQuestion?.marks || test?.defaultMarksPerQuestion || 4} / -
            {currentQuestion?.negativeMarks || test?.negativeMarkPerWrong || 1}
          </Text>
        </View>
      </View>

      {/* Question Content Viewport */}
      <ScrollView style={styles.questionViewport} contentContainerStyle={styles.viewportContent}>
        {/* Question Text with KaTeX formulas */}
        <MathFormulaView content={currentQuestion?.text || ''} fontSize={16} />

        {/* Diagram / Image */}
        {currentQuestion?.imageUrl ? (
          <TouchableOpacity
            style={styles.imageCard}
            onPress={() => setZoomImageUrl(currentQuestion.imageUrl || null)}
            activeOpacity={0.9}
          >
            <Image
              source={{ uri: currentQuestion.imageUrl }}
              style={styles.questionImage}
              resizeMode="contain"
            />
            <View style={styles.zoomPill}>
              <Maximize2 size={12} color="#FFFFFF" />
              <Text style={styles.zoomPillText}>Tap to Zoom Diagram</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {/* Options / Answer Input */}
        {currentQuestion?.type === 'numerical' ? (
          <View style={styles.numericalSection}>
            <Keypad
              value={selectedAnswer ? String(selectedAnswer) : ''}
              onChange={handleNumericalInput}
            />
          </View>
        ) : (
          <View style={styles.optionsList}>
            {currentQuestion?.options.map((optionText, optIdx) => {
              const isSelected = selectedAnswer === optIdx;
              const optionLetters = ['A', 'B', 'C', 'D', 'E'];
              const letter = optionLetters[optIdx] || String(optIdx + 1);

              return (
                <TouchableOpacity
                  key={optIdx}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => handleSelectOption(optIdx)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}>
                    <Text style={[styles.optionLetter, isSelected && styles.optionLetterSelected]}>
                      {letter}
                    </Text>
                  </View>
                  <View style={styles.optionContent}>
                    <MathFormulaView
                      content={optionText}
                      fontSize={15}
                      textColor={isSelected ? '#1E293B' : '#334155'}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.actionBar}>
        <View style={styles.actionBarTop}>
          <TouchableOpacity
            style={styles.actionPill}
            onPress={handleMarkForReviewAndNext}
            activeOpacity={0.7}
          >
            <Flag size={14} color="#8B5CF6" />
            <Text style={styles.actionPillTextPurple}>Review & Next</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionPill}
            onPress={handleClearResponse}
            activeOpacity={0.7}
          >
            <RotateCcw size={14} color="#64748B" />
            <Text style={styles.actionPillTextSlate}>Clear</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.submitTestPill}
            onPress={() => setConfirmSubmitVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.submitTestPillText}>Submit Test</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionBarBottom}>
          <TouchableOpacity
            style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
            onPress={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            activeOpacity={0.7}
          >
            <ChevronLeft size={18} color={currentIndex === 0 ? '#94A3B8' : '#1E293B'} />
            <Text style={[styles.navBtnText, currentIndex === 0 && styles.navBtnTextDisabled]}>
              Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveNextBtn}
            onPress={handleSaveAndNext}
            activeOpacity={0.8}
          >
            <Text style={styles.saveNextBtnText}>Save & Next</Text>
            <ChevronRight size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Question Palette Modal */}
      <QuestionPaletteModal
        visible={paletteVisible}
        onClose={() => setPaletteVisible(false)}
        totalQuestions={questions.length}
        currentIndex={currentIndex}
        onSelectQuestion={(idx) => setCurrentIndex(idx)}
        paletteStatus={paletteStatus}
        questionIds={questions.map((q) => q.id)}
        onSubmit={() => setConfirmSubmitVisible(true)}
      />

      {/* Image Zoom Modal */}
      <ImageZoomModal
        visible={!!zoomImageUrl}
        imageUrl={zoomImageUrl || undefined}
        onClose={() => setZoomImageUrl(null)}
      />

      {/* Submission Confirmation Dialog */}
      <Modal
        visible={confirmSubmitVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmSubmitVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalCard}>
            <Text style={styles.confirmModalTitle}>Confirm Submission</Text>
            <Text style={styles.confirmModalSubtitle}>
              Are you sure you want to finish and submit your test?
            </Text>

            {/* Summary statistics */}
            <View style={styles.summaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Questions:</Text>
                <Text style={styles.summaryVal}>{questions.length}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Answered:</Text>
                <Text style={[styles.summaryVal, { color: '#10B981' }]}>
                  {Object.values(answers).filter((v) => v !== null && v !== undefined && v !== '').length}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Marked for Review:</Text>
                <Text style={[styles.summaryVal, { color: '#8B5CF6' }]}>
                  {markedForReview.length}
                </Text>
              </View>
            </View>

            <View style={styles.confirmModalActions}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setConfirmSubmitVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Continue Test</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmModalBtn}
                onPress={performSubmission}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.confirmModalBtnText}>Confirm & Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Anti-Cheat Strike Warning Modal */}
      <Modal visible={strikeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.strikeCard}>
            <AlertTriangle size={36} color="#DC2626" />
            <Text style={styles.strikeTitle}>Proctoring Alert: Strike {strikes} of 3</Text>
            <Text style={styles.strikeDesc}>
              Warning: You navigated away from the examination screen or minimized the app. All actions are logged. If you reach 3 strikes, your test will be permanently force-submitted.
            </Text>
            <TouchableOpacity
              style={styles.strikeAckBtn}
              onPress={() => setStrikeModalVisible(false)}
            >
              <Text style={styles.strikeAckBtnText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '600',
  },
  instructionsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  instructionsHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  instructionsContent: {
    flex: 1,
  },
  instructionsScroll: {
    padding: 20,
    gap: 16,
  },
  instructionsBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionsBannerImage: {
    width: '100%',
    height: 54,
    borderRadius: 6,
  },
  testMetaCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  markingCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  markingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3730A3',
    marginBottom: 4,
  },
  markingText: {
    fontSize: 12,
    color: '#4338CA',
    fontWeight: '500',
  },
  legendCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  legendCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  legendGuideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendGuideText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  rulesCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 6,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  rulesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400E',
  },
  rulesItem: {
    fontSize: 12,
    color: '#B45309',
    lineHeight: 18,
  },
  passcodeSection: {
    gap: 6,
  },
  passcodeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  passcodeInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    fontSize: 14,
    color: '#0F172A',
  },
  passcodeErrorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500',
  },
  agreementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  agreementText: {
    flex: 1,
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
  },
  instructionsFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  beginBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  beginBtnDisabled: {
    opacity: 0.5,
  },
  beginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  examHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  examHeaderInfo: {
    flex: 1,
  },
  examHeaderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  partLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4F46E5',
    marginTop: 1,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  timerBadgeCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
  },
  timerTextCritical: {
    color: '#EF4444',
  },
  paletteTriggerBtn: {
    backgroundColor: '#4F46E5',
    padding: 8,
    borderRadius: 8,
  },
  questionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  questionNoText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  marksBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  marksBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  questionViewport: {
    flex: 1,
  },
  viewportContent: {
    padding: 16,
    gap: 16,
  },
  imageCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    alignItems: 'center',
    position: 'relative',
  },
  questionImage: {
    width: '100%',
    height: 180,
  },
  zoomPill: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  zoomPillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  numericalSection: {
    marginTop: 8,
  },
  optionsList: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  optionCardSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  optionRadio: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    backgroundColor: '#FFFFFF',
  },
  optionRadioSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  optionLetter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  optionLetterSelected: {
    color: '#FFFFFF',
  },
  optionContent: {
    flex: 1,
  },
  actionBar: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    padding: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  actionBarTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionPillTextPurple: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  actionPillTextSlate: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  submitTestPill: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  submitTestPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionBarBottom: {
    flexDirection: 'row',
    gap: 12,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    height: 46,
  },
  navBtnDisabled: {
    opacity: 0.5,
  },
  navBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  navBtnTextDisabled: {
    color: '#94A3B8',
  },
  saveNextBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 10,
    height: 46,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  saveNextBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  confirmModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  confirmModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  confirmModalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  summaryBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  summaryVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  confirmModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelModalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  cancelModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  confirmModalBtn: {
    flex: 1.3,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
  },
  confirmModalBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  strikeCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  strikeTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#DC2626',
    textAlign: 'center',
  },
  strikeDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  strikeAckBtn: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  strikeAckBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
