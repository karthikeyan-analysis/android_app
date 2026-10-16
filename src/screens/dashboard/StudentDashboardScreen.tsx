import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpen,
  Video,
  FileText,
  Radio,
  Layers,
  ChevronRight,
  ArrowRight,
  Clock,
  PlayCircle,
  Award,
  CheckCircle2,
  Calendar,
  X,
  LogOut,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { MainTabParamList, RootStackParamList } from '../../types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'DashboardTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

function greetingForHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function isSameDay(dateStr: string, targetDate = new Date()): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return (
    d.getFullYear() === targetDate.getFullYear() &&
    d.getMonth() === targetDate.getMonth() &&
    d.getDate() === targetDate.getDate()
  );
}

export const StudentDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setActiveBatch, logout } = useAuth();
  const { currentBatch, batches, content, videos, tests, liveClasses, loading, refreshData } =
    useData();

  const [refreshing, setRefreshing] = useState(false);
  const [batchModalVisible, setBatchModalVisible] = useState(false);

  const enrolledBatchIds = user?.batchIds?.length
    ? user.batchIds
    : user?.batchId
    ? [user.batchId]
    : [];

  const enrolledBatches = batches.filter((b) => enrolledBatchIds.includes(b.id));

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  // Metrics
  const resourcesCount = content.length;
  const videosCount = videos.length;

  const todayTests = useMemo(() => {
    return tests.filter((t) => isSameDay(t.startAt));
  }, [tests]);

  const activeLiveClass = useMemo(() => {
    return liveClasses.find((cls) => cls.status === 'active') || null;
  }, [liveClasses]);

  const subjects = useMemo(() => {
    if (!currentBatch?.subjects?.length) {
      // Fallback: extract subjects from content & videos
      const set = new Set<string>();
      content.forEach((c) => c.subject && set.add(c.subject));
      videos.forEach((v) => v.subject && set.add(v.subject));
      return Array.from(set);
    }
    return currentBatch.subjects;
  }, [currentBatch, content, videos]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
      >
        {/* Official Institute Banner Header */}
        <View style={styles.instituteBannerCard}>
          <Image
            source={require('../../../assets/banner.jpeg')}
            style={styles.instituteBannerImage}
            resizeMode="contain"
          />
        </View>

        {/* Top Student Hero Header */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroGreetingBlock}>
              <Text style={styles.greetingText}>{greetingForHour()},</Text>
              <Text style={styles.studentNameText} numberOfLines={1}>
                {user?.name || 'Student'}
              </Text>
            </View>

            <View style={styles.heroAvatarRow}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>
                    {getInitials(user?.name || 'Student')}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.logoutPill}
                onPress={logout}
                activeOpacity={0.7}
              >
                <LogOut size={16} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Active Batch Indicator / Switcher */}
          <View style={styles.batchSection}>
            <View style={styles.batchInfo}>
              <Text style={styles.batchLabel}>ENROLLED BATCH</Text>
              <Text style={styles.batchName} numberOfLines={1}>
                {currentBatch?.name || 'Assigned Batch'}
              </Text>
            </View>

            {enrolledBatches.length > 1 ? (
              <TouchableOpacity
                style={styles.switchBatchBtn}
                onPress={() => setBatchModalVisible(true)}
                activeOpacity={0.8}
              >
                <Layers size={14} color="#FFFFFF" />
                <Text style={styles.switchBatchBtnText}>Switch</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Live Classes Banner */}
        {activeLiveClass ? (
          <View style={styles.liveNowCard}>
            <View style={styles.liveNowHeader}>
              <View style={styles.livePill}>
                <View style={styles.livePulseDot} />
                <Text style={styles.livePillText}>LIVE NOW</Text>
              </View>
              <Text style={styles.liveSubject}>{activeLiveClass.subject || 'Live Class'}</Text>
            </View>

            <Text style={styles.liveTitle} numberOfLines={1}>
              {activeLiveClass.name}
            </Text>

            <TouchableOpacity
              style={styles.joinLiveBtn}
              onPress={() =>
                navigation.navigate('LiveClassRoom', {
                  classId: activeLiveClass.id,
                  title: activeLiveClass.name,
                  subject: activeLiveClass.subject,
                })
              }
              activeOpacity={0.8}
            >
              <Radio size={18} color="#FFFFFF" />
              <Text style={styles.joinLiveBtnText}>Join Live Session</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Top Metrics Row */}
        <View style={styles.metricsRow}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('MediaTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <FileText size={20} color="#4F46E5" />
            </View>
            <Text style={styles.metricCount}>{resourcesCount}</Text>
            <Text style={styles.metricLabel}>Study Notes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('MediaTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#F0FDF4' }]}>
              <Video size={20} color="#16A34A" />
            </View>
            <Text style={styles.metricCount}>{videosCount}</Text>
            <Text style={styles.metricLabel}>Video Lessons</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => navigation.navigate('TestsTab')}
            activeOpacity={0.8}
          >
            <View style={[styles.metricIconWrap, { backgroundColor: '#FFFBEB' }]}>
              <Award size={20} color="#D97706" />
            </View>
            <Text style={styles.metricCount}>{todayTests.length}</Text>
            <Text style={styles.metricLabel}>Today's Tests</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Scheduled Tests Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Scheduled Tests</Text>
          <TouchableOpacity onPress={() => navigation.navigate('TestsTab')}>
            <Text style={styles.sectionAction}>View All</Text>
          </TouchableOpacity>
        </View>

        {todayTests.length > 0 ? (
          todayTests.map((test) => (
            <View key={test.id} style={styles.testCard}>
              <View style={styles.testCardTop}>
                <View style={styles.testSubjectBadge}>
                  <Text style={styles.testSubjectBadgeText}>{test.subject || 'All Subjects'}</Text>
                </View>
                <View style={styles.testDurationBadge}>
                  <Clock size={12} color="#64748B" />
                  <Text style={styles.testDurationText}>{test.durationMinutes} mins</Text>
                </View>
              </View>

              <Text style={styles.testTitle}>{test.title}</Text>

              <View style={styles.testCardFooter}>
                <Text style={styles.testMarksText}>
                  {test.totalQuestions || 0} Questions • {test.totalMarks || 0} Marks
                </Text>
                <TouchableOpacity
                  style={styles.takeTestBtn}
                  onPress={() => navigation.navigate('TakeExam', { testId: test.id, title: test.title })}
                  activeOpacity={0.8}
                >
                  <Text style={styles.takeTestBtnText}>Take Test</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Calendar size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Tests Scheduled Today</Text>
            <Text style={styles.emptySubtitle}>
              Check the Tests tab for upcoming mock tests and full-syllabus exams.
            </Text>
          </View>
        )}

        {/* Subject Directory Section */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Subjects & Syllabus</Text>
        </View>

        <View style={styles.subjectsGrid}>
          {subjects.map((sub, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.subjectTile}
              onPress={() => navigation.navigate('MediaTab', { preselectedSubject: sub })}
              activeOpacity={0.7}
            >
              <View style={styles.subjectIconWrap}>
                <BookOpen size={20} color="#4F46E5" />
              </View>
              <Text style={styles.subjectTileText} numberOfLines={2}>
                {sub}
              </Text>
              <ChevronRight size={16} color="#CBD5E1" style={styles.subjectTileArrow} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Batch Switcher Modal */}
      <Modal
        visible={batchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBatchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch Active Batch</Text>
              <TouchableOpacity onPress={() => setBatchModalVisible(false)}>
                <X size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalList}>
              {enrolledBatches.map((b) => {
                const isSelected = user?.batchId === b.id;
                return (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.modalItem, isSelected && styles.modalItemSelected]}
                    onPress={async () => {
                      await setActiveBatch(b.id);
                      setBatchModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemName,
                        isSelected && styles.modalItemNameSelected,
                      ]}
                    >
                      {b.name}
                    </Text>
                    {isSelected ? <CheckCircle2 size={18} color="#4F46E5" /> : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 36,
  },
  instituteBannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instituteBannerImage: {
    width: '100%',
    height: 52,
    borderRadius: 8,
  },
  heroCard: {
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroGreetingBlock: {
    flex: 1,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#A5B4FC',
  },
  studentNameText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  heroAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#818CF8',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#4338CA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#818CF8',
  },
  avatarInitials: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  logoutPill: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  batchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  batchInfo: {
    flex: 1,
  },
  batchLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#818CF8',
    letterSpacing: 0.5,
  },
  batchName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  switchBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchBatchBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  liveNowCard: {
    backgroundColor: '#064E3B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#059669',
  },
  liveNowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#047857',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  livePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ECFDF5',
  },
  liveSubject: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A7F3D0',
  },
  liveTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  joinLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 10,
    height: 42,
  },
  joinLiveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  metricIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  metricCount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  testCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  testCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  testSubjectBadge: {
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  testSubjectBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  testDurationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  testDurationText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748B',
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  testCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  testMarksText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  takeTestBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  takeTestBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  subjectTile: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subjectIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectTileText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  subjectTileArrow: {
    marginLeft: 'auto',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  modalItemSelected: {
    backgroundColor: '#EEF2FF',
  },
  modalItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  modalItemNameSelected: {
    color: '#4F46E5',
    fontWeight: '700',
  },
});

