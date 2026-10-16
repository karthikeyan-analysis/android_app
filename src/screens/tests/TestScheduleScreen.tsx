import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Award,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  FileText,
  ChevronRight,
  Lock,
} from 'lucide-react-native';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ExamAttempt, ExamTest, MainTabParamList, RootStackParamList } from '../../types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'TestsTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

type TabMode = 'active' | 'completed';

export const TestScheduleScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const { tests, loading, refreshData } = useData();

  const [activeTab, setActiveTab] = useState<TabMode>('active');
  const [attemptsMap, setAttemptsMap] = useState<Record<string, ExamAttempt>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Load user attempts for tests
  useEffect(() => {
    if (!user?.id) return;
    const fetchAttempts = async () => {
      const map: Record<string, ExamAttempt> = {};
      try {
        await Promise.all(
          tests.map(async (test) => {
            const attemptSnap = await getDoc(
              doc(db, 'examTests', test.id, 'attempts', user.id)
            );
            if (attemptSnap.exists()) {
              map[test.id] = { id: attemptSnap.id, ...(attemptSnap.data() as any) };
            }
          })
        );
        setAttemptsMap(map);
      } catch (err) {
        console.warn('[TESTS] Error loading attempts:', err);
      }
    };
    fetchAttempts();
  }, [user?.id, tests]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const now = new Date().getTime();

  const { activeTests, completedTests } = useMemo(() => {
    const active: ExamTest[] = [];
    const completed: ExamTest[] = [];

    tests.forEach((test) => {
      const attempt = attemptsMap[test.id];
      if (attempt?.status === 'submitted') {
        completed.push(test);
      } else {
        active.push(test);
      }
    });

    return { activeTests: active, completedTests: completed };
  }, [tests, attemptsMap]);

  const currentList = activeTab === 'active' ? activeTests : completedTests;

  const renderTestItem = ({ item }: { item: ExamTest }) => {
    const attempt = attemptsMap[item.id];
    const isSubmitted = attempt?.status === 'submitted';
    const startMs = item.startAt ? new Date(item.startAt).getTime() : 0;
    const endMs = item.endAt ? new Date(item.endAt).getTime() : 0;

    let timeBadgeText = 'Active Now';
    let timeBadgeColor = '#10B981';

    if (startMs > now) {
      timeBadgeText = 'Upcoming';
      timeBadgeColor = '#6366F1';
    } else if (endMs > 0 && now > endMs) {
      timeBadgeText = 'Window Closed';
      timeBadgeColor = '#64748B';
    }

    const startDateStr = item.startAt
      ? new Date(item.startAt).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Flexible';

    return (
      <View style={styles.testCard}>
        <View style={styles.cardHeader}>
          <View style={styles.subjectPill}>
            <Text style={styles.subjectPillText}>{item.subject || 'All Subjects'}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: `${timeBadgeColor}15` }]}>
            <Text style={[styles.statusBadgeText, { color: timeBadgeColor }]}>
              {isSubmitted ? 'Completed' : timeBadgeText}
            </Text>
          </View>
        </View>

        <Text style={styles.testTitle}>{item.title}</Text>
        {item.description ? (
          <Text style={styles.testDesc} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Clock size={14} color="#64748B" />
            <Text style={styles.metaText}>{item.durationMinutes} mins</Text>
          </View>
          <View style={styles.metaItem}>
            <Calendar size={14} color="#64748B" />
            <Text style={styles.metaText}>{startDateStr}</Text>
          </View>
          <View style={styles.metaItem}>
            <Award size={14} color="#64748B" />
            <Text style={styles.metaText}>{item.totalMarks || 0} Marks</Text>
          </View>
        </View>

        {/* Action Row */}
        <View style={styles.actionRow}>
          {isSubmitted ? (
            <View style={styles.completedButtonsRow}>
              <TouchableOpacity
                style={styles.scorecardBtn}
                onPress={() => navigation.navigate('ExamResult', { testId: item.id })}
                activeOpacity={0.8}
              >
                <Award size={16} color="#4F46E5" />
                <Text style={styles.scorecardBtnText}>Scorecard</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.responseSheetBtn}
                onPress={() => navigation.navigate('ResponseSheet', { testId: item.id })}
                activeOpacity={0.8}
              >
                <FileText size={16} color="#0F172A" />
                <Text style={styles.responseSheetBtnText}>Response Sheet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.startBtn}
              onPress={() =>
                navigation.navigate('TakeExam', { testId: item.id, title: item.title })
              }
              activeOpacity={0.8}
            >
              <Text style={styles.startBtnText}>
                {attempt?.status === 'in_progress' ? 'Resume Examination' : 'Start Examination'}
              </Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Examinations & Tests</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active & Upcoming ({activeTests.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Completed ({completedTests.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={currentList}
        keyExtractor={(item) => item.id}
        renderItem={renderTestItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Award size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>
              {activeTab === 'active' ? 'No Active Tests' : 'No Completed Tests'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'active'
                ? 'When faculty schedules mock tests for your batch, they will appear here.'
                : 'Examinations you submit will appear here with instant scorecards and response sheets.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  tabActive: {
    backgroundColor: '#4F46E5',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 20,
    gap: 14,
  },
  testCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectPill: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subjectPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  testTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  testDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  actionRow: {
    marginTop: 12,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  startBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  completedButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scorecardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  scorecardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  responseSheetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  responseSheetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 56,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
  },
});

