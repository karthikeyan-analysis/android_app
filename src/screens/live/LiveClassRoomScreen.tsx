import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Send,
  MessageSquare,
  HelpCircle,
  Bell,
  Sparkles,
  Award,
  CheckCircle2,
  Clock,
  Radio,
  X,
} from 'lucide-react-native';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { LiveClass, LiveClassDoubt, RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveClassRoom'>;

export const LiveClassRoomScreen: React.FC<Props> = ({ navigation, route }) => {
  const { classId, title, subject } = route.params;
  const { user } = useAuth();

  // Media toggles
  const [micEnabled, setMicEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  // Live class metadata & live test monitoring
  const [classData, setClassData] = useState<LiveClass | null>(null);
  const [showLiveTestModal, setShowLiveTestModal] = useState(false);
  const [activeLiveTestId, setActiveLiveTestId] = useState<string | null>(null);
  const prevLiveTestActiveRef = useRef<boolean>(false);

  // Doubts Messenger
  const [doubts, setDoubts] = useState<LiveClassDoubt[]>([]);
  const [doubtText, setDoubtText] = useState('');
  const [sendingDoubt, setSendingDoubt] = useState(false);
  const [doubtsModalVisible, setDoubtsModalVisible] = useState(false);

  const joinTimeRef = useRef<string>(new Date().toISOString());

  // 1. Participant Attendance Tracking (Join on mount, Leave on unmount)
  useEffect(() => {
    if (!classId || !user?.id) return;

    const joinedAt = new Date().toISOString();
    joinTimeRef.current = joinedAt;

    // Record Join
    const attendanceDocRef = doc(db, 'liveClassAttendance', classId, 'records', user.id);
    setDoc(
      attendanceDocRef,
      {
        uid: user.id,
        studentName: user.name || 'Student',
        studentId: user.studentId || null,
        batchId: user.batchId || null,
        joinedAt,
        joinedAtServer: serverTimestamp(),
      },
      { merge: true }
    ).catch((err) => console.warn('[ATTENDANCE] Error recording join:', err));

    return () => {
      // Record Leave on unmount
      const leftAt = new Date().toISOString();
      const durationMins = Math.max(
        1,
        Math.round((Date.now() - new Date(joinedAt).getTime()) / 60000)
      );

      updateDoc(attendanceDocRef, {
        leftAt,
        durationMinutes: durationMins,
        leftAtServer: serverTimestamp(),
      }).catch((err) => console.warn('[ATTENDANCE] Error recording leave:', err));
    };
  }, [classId, user?.id, user?.name, user?.studentId, user?.batchId]);

  // 2. Listen to Live Class Doc for in-room tests & live status
  useEffect(() => {
    if (!classId) return;

    const unsub = onSnapshot(doc(db, 'liveClasses', classId), (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data() as LiveClass;
      setClassData(data);

      const isTestActive = data.liveTestActive === true && !!data.liveTestId && data.liveTestId !== 'none';
      if (isTestActive && !prevLiveTestActiveRef.current) {
        setActiveLiveTestId(data.liveTestId!);
        setShowLiveTestModal(true);
      }
      prevLiveTestActiveRef.current = isTestActive;

      // Class ended
      if (data.status === 'ended') {
        Alert.alert('Session Ended', 'The instructor has ended this live class session.', [
          { text: 'Leave', onPress: () => navigation.goBack() },
        ]);
      }
    });

    return () => unsub();
  }, [classId, navigation]);

  // 3. Real-time Doubt Messenger subscription for own doubts
  useEffect(() => {
    if (!classId || !user?.id) return;

    const q = query(
      collection(db, 'liveClassDoubts', classId, 'doubts'),
      where('studentUid', '==', user.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: LiveClassDoubt[] = snapshot.docs.map((d) => ({
        id: d.id,
        studentUid: d.data().studentUid,
        studentName: d.data().studentName,
        question: d.data().question,
        answer: d.data().answer,
        status: d.data().status || 'pending',
        createdAt: d.data().createdAt,
        answeredAt: d.data().answeredAt,
      }));

      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDoubts(list);
    });

    return () => unsub();
  }, [classId, user?.id]);

  // Submit Doubt
  const handleSubmitDoubt = async () => {
    if (!doubtText.trim() || !user?.id) return;
    setSendingDoubt(true);
    try {
      await addDoc(collection(db, 'liveClassDoubts', classId, 'doubts'), {
        studentUid: user.id,
        studentName: user.name || 'Student',
        question: doubtText.trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        createdAtServer: serverTimestamp(),
      });
      setDoubtText('');
    } catch (err) {
      console.error('[DOUBTS] Error sending question:', err);
      Alert.alert('Error', 'Could not send question to instructor.');
    } finally {
      setSendingDoubt(false);
    }
  };

  const handleLaunchInClassTest = () => {
    setShowLiveTestModal(false);
    if (activeLiveTestId) {
      navigation.navigate('TakeExam', { testId: activeLiveTestId });
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title || classData?.name || 'Live Classroom'}
          </Text>
          <View style={styles.liveIndicator}>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveIndicatorText}>
              {subject || classData?.subject || 'Live Interactive Class'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.doubtIconBtn}
          onPress={() => setDoubtsModalVisible(true)}
          activeOpacity={0.7}
        >
          <MessageSquare size={18} color="#FFFFFF" />
          {doubts.length > 0 ? (
            <View style={styles.doubtBadge}>
              <Text style={styles.doubtBadgeText}>{doubts.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Main Video Stage */}
      <View style={styles.stageContainer}>
        {/* Instructor Screen / Stream Tile */}
        <View style={styles.instructorTile}>
          <Radio size={48} color="#818CF8" />
          <Text style={styles.instructorTileTitle}>Instructor Live Video Stream</Text>
          <Text style={styles.instructorTileSub}>
            Audio & HD Video streaming from faculty
          </Text>
          <View style={styles.connectedTag}>
            <View style={styles.tagDot} />
            <Text style={styles.tagText}>Connected • Attendance Active</Text>
          </View>
        </View>

        {/* Floating Student Self Tile */}
        <View style={styles.studentTile}>
          <Text style={styles.studentTileInitials}>{user?.name?.slice(0, 2) || 'ME'}</Text>
          <View style={styles.studentStatusRow}>
            {micEnabled ? (
              <Mic size={10} color="#10B981" />
            ) : (
              <MicOff size={10} color="#EF4444" />
            )}
            {cameraEnabled ? (
              <Video size={10} color="#10B981" />
            ) : (
              <VideoOff size={10} color="#EF4444" />
            )}
          </View>
        </View>
      </View>

      {/* Interactive In-Call Action Bar */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.controlBtn, micEnabled && styles.controlBtnActive]}
          onPress={() => setMicEnabled(!micEnabled)}
          activeOpacity={0.8}
        >
          {micEnabled ? (
            <Mic size={22} color="#FFFFFF" />
          ) : (
            <MicOff size={22} color="#CBD5E1" />
          )}
          <Text style={styles.controlBtnText}>{micEnabled ? 'Mic On' : 'Muted'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, cameraEnabled && styles.controlBtnActive]}
          onPress={() => setCameraEnabled(!cameraEnabled)}
          activeOpacity={0.8}
        >
          {cameraEnabled ? (
            <Video size={22} color="#FFFFFF" />
          ) : (
            <VideoOff size={22} color="#CBD5E1" />
          )}
          <Text style={styles.controlBtnText}>{cameraEnabled ? 'Cam On' : 'Cam Off'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlBtn}
          onPress={() => setDoubtsModalVisible(true)}
          activeOpacity={0.8}
        >
          <HelpCircle size={22} color="#818CF8" />
          <Text style={[styles.controlBtnText, { color: '#818CF8' }]}>Ask Doubt</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <PhoneOff size={22} color="#FFFFFF" />
          <Text style={styles.leaveBtnText}>Leave</Text>
        </TouchableOpacity>
      </View>

      {/* In-Class Live Test Alert Modal */}
      <Modal
        visible={showLiveTestModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLiveTestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.liveTestModalCard}>
            <View style={styles.liveTestIconWrap}>
              <Award size={36} color="#4F46E5" />
            </View>
            <Text style={styles.liveTestTitle}>Live Test Launched!</Text>
            <Text style={styles.liveTestDesc}>
              The instructor has started an interactive in-class CBT examination. Tap below to launch your exam immediately.
            </Text>

            <TouchableOpacity
              style={styles.launchTestBtn}
              onPress={handleLaunchInClassTest}
              activeOpacity={0.8}
            >
              <Text style={styles.launchTestBtnText}>Start Test Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dismissTestBtn}
              onPress={() => setShowLiveTestModal(false)}
            >
              <Text style={styles.dismissTestBtnText}>Take Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Doubts Messenger Modal */}
      <Modal
        visible={doubtsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDoubtsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.doubtsModalContainer}>
            <View style={styles.doubtsHeader}>
              <View style={styles.doubtsHeaderLeft}>
                <HelpCircle size={20} color="#4F46E5" />
                <Text style={styles.doubtsHeaderTitle}>Class Doubt Messenger</Text>
              </View>
              <TouchableOpacity
                onPress={() => setDoubtsModalVisible(false)}
                style={styles.doubtsCloseBtn}
              >
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* List of Doubts */}
            <FlatList
              data={doubts}
              keyExtractor={(item) => item.id}
              style={styles.doubtsList}
              contentContainerStyle={styles.doubtsListContent}
              renderItem={({ item }) => (
                <View style={styles.doubtItemCard}>
                  <View style={styles.doubtStatusRow}>
                    <Text style={styles.doubtQuestionText}>{item.question}</Text>
                    {item.status === 'answered' ? (
                      <View style={styles.answeredBadge}>
                        <CheckCircle2 size={12} color="#10B981" />
                        <Text style={styles.answeredBadgeText}>Answered</Text>
                      </View>
                    ) : (
                      <View style={styles.pendingBadge}>
                        <Clock size={12} color="#D97706" />
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    )}
                  </View>

                  {item.answer ? (
                    <View style={styles.teacherReplyBox}>
                      <Text style={styles.teacherReplyLabel}>Instructor Reply:</Text>
                      <Text style={styles.teacherReplyText}>{item.answer}</Text>
                    </View>
                  ) : null}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyDoubts}>
                  <Text style={styles.emptyDoubtsTitle}>No doubts asked yet</Text>
                  <Text style={styles.emptyDoubtsSubtitle}>
                    Have a question on today's lecture? Type your doubt below to send directly to the instructor.
                  </Text>
                </View>
              }
            />

            {/* Doubt Input Row */}
            <View style={styles.doubtInputRow}>
              <TextInput
                style={styles.doubtInput}
                placeholder="Ask instructor a question..."
                placeholderTextColor="#94A3B8"
                value={doubtText}
                onChangeText={setDoubtText}
                multiline
              />
              <TouchableOpacity
                style={[
                  styles.sendDoubtBtn,
                  (!doubtText.trim() || sendingDoubt) && styles.sendDoubtBtnDisabled,
                ]}
                onPress={handleSubmitDoubt}
                disabled={!doubtText.trim() || sendingDoubt}
                activeOpacity={0.8}
              >
                {sendingDoubt ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Send size={18} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  liveIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#34D399',
  },
  doubtIconBtn: {
    position: 'relative',
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  doubtBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doubtBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stageContainer: {
    flex: 1,
    backgroundColor: '#020617',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructorTile: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  instructorTileTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  instructorTileSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
  connectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    marginTop: 8,
  },
  tagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10B981',
  },
  studentTile: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 90,
    height: 120,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentTileInitials: {
    fontSize: 22,
    fontWeight: '800',
    color: '#818CF8',
  },
  studentStatusRow: {
    position: 'absolute',
    bottom: 6,
    flexDirection: 'row',
    gap: 6,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 14,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  controlBtn: {
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderRadius: 12,
  },
  controlBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  leaveBtn: {
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  leaveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  liveTestModalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  liveTestIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveTestTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  liveTestDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  launchTestBtn: {
    width: '100%',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  launchTestBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dismissTestBtn: {
    paddingVertical: 6,
  },
  dismissTestBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSafe: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  doubtsModalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    display: 'flex',
    flexDirection: 'column',
  },
  doubtsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  doubtsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doubtsHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  doubtsCloseBtn: {
    padding: 4,
  },
  doubtsList: {
    flex: 1,
  },
  doubtsListContent: {
    padding: 16,
    gap: 12,
  },
  doubtItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  doubtStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  doubtQuestionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  answeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  answeredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D97706',
  },
  teacherReplyBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 8,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
    gap: 2,
  },
  teacherReplyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  teacherReplyText: {
    fontSize: 13,
    color: '#334155',
  },
  emptyDoubts: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 6,
  },
  emptyDoubtsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
  },
  emptyDoubtsSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 240,
  },
  doubtInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  doubtInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    color: '#0F172A',
  },
  sendDoubtBtn: {
    backgroundColor: '#4F46E5',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDoubtBtnDisabled: {
    opacity: 0.5,
  },
});

