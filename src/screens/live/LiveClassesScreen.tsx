import React, { useMemo, useState } from 'react';
import {
  FlatList,
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
  Video,
  Radio,
  Calendar,
  Clock,
  ArrowRight,
  PlayCircle,
  Film,
  User,
} from 'lucide-react-native';

import { useData } from '../../context/DataContext';
import { LiveClass, MainTabParamList, RootStackParamList } from '../../types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'LiveClassesTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

type StatusFilter = 'all' | 'active' | 'scheduled' | 'ended';

export const LiveClassesScreen: React.FC<Props> = ({ navigation, route }) => {
  const { liveClasses, refreshData } = useData();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>(route.params?.subject || 'all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

  const subjects = useMemo(() => {
    const set = new Set<string>();
    liveClasses.forEach((c) => c.subject?.trim() && set.add(c.subject.trim()));
    return Array.from(set).sort();
  }, [liveClasses]);

  const filteredClasses = useMemo(() => {
    return liveClasses.filter((cls) => {
      if (statusFilter !== 'all' && cls.status !== statusFilter) return false;
      if (selectedSubject !== 'all' && cls.subject?.toLowerCase() !== selectedSubject.toLowerCase()) {
        return false;
      }
      return true;
    });
  }, [liveClasses, statusFilter, selectedSubject]);

  const liveCount = liveClasses.filter((c) => c.status === 'active').length;

  const renderClassItem = ({ item }: { item: LiveClass }) => {
    const isActive = item.status === 'active';
    const isEnded = item.status === 'ended';

    const scheduledDateStr = item.scheduledAt
      ? new Date(item.scheduledAt).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Live Discussion';

    return (
      <View style={[styles.classCard, isActive && styles.classCardActive]}>
        <View style={styles.cardHeader}>
          <View style={styles.subjectPill}>
            <Text style={styles.subjectPillText}>{item.subject || 'General'}</Text>
          </View>

          {isActive ? (
            <View style={styles.liveIndicator}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveIndicatorText}>LIVE NOW</Text>
            </View>
          ) : isEnded ? (
            <View style={styles.endedBadge}>
              <Text style={styles.endedBadgeText}>Completed</Text>
            </View>
          ) : (
            <View style={styles.scheduledBadge}>
              <Clock size={12} color="#D97706" />
              <Text style={styles.scheduledBadgeText}>Scheduled</Text>
            </View>
          )}
        </View>

        <Text style={styles.classTitle}>{item.name}</Text>

        <View style={styles.metaRow}>
          {item.instructorName ? (
            <View style={styles.metaItem}>
              <User size={13} color="#64748B" />
              <Text style={styles.metaText}>{item.instructorName}</Text>
            </View>
          ) : null}
          <View style={styles.metaItem}>
            <Calendar size={13} color="#64748B" />
            <Text style={styles.metaText}>{scheduledDateStr}</Text>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionRow}>
          {isActive ? (
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() =>
                navigation.navigate('LiveClassRoom', {
                  classId: item.id,
                  title: item.name,
                  subject: item.subject,
                })
              }
              activeOpacity={0.8}
            >
              <Radio size={16} color="#FFFFFF" />
              <Text style={styles.joinBtnText}>Join Classroom Now</Text>
              <ArrowRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : item.recordingDownloadUrl ? (
            <TouchableOpacity
              style={styles.watchRecordingBtn}
              onPress={() =>
                navigation.navigate('VideoPlayer', {
                  videoId: item.id,
                  title: item.name,
                  videoUrl: item.recordingDownloadUrl!,
                  description: `Recorded session for ${item.subject}`,
                  isLiveRecording: true,
                })
              }
              activeOpacity={0.8}
            >
              <PlayCircle size={16} color="#16A34A" />
              <Text style={styles.watchRecordingBtnText}>Watch Archive Recording</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Live Online Classes</Text>
          {liveCount > 0 ? (
            <Text style={styles.liveCountSubtitle}>
              {liveCount} class{liveCount === 1 ? '' : 'es'} actively streaming now
            </Text>
          ) : null}
        </View>
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.statusTabs}>
        {(['all', 'active', 'scheduled', 'ended'] as StatusFilter[]).map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.statusTab, statusFilter === st && styles.statusTabActive]}
            onPress={() => setStatusFilter(st)}
          >
            <Text
              style={[
                styles.statusTabText,
                statusFilter === st && styles.statusTabTextActive,
              ]}
            >
              {st === 'all'
                ? 'All'
                : st === 'active'
                ? 'Live Now'
                : st === 'scheduled'
                ? 'Scheduled'
                : 'Completed'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Subject Filter Bar */}
      {subjects.length > 0 ? (
        <View style={styles.subjectBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectScroll}>
            <TouchableOpacity
              style={[
                styles.subjectPill,
                selectedSubject === 'all' && styles.subjectPillActive,
              ]}
              onPress={() => setSelectedSubject('all')}
            >
              <Text
                style={[
                  styles.subjectPillText,
                  selectedSubject === 'all' && styles.subjectPillTextActive,
                ]}
              >
                All Subjects
              </Text>
            </TouchableOpacity>

            {subjects.map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.subjectPill,
                  selectedSubject === s && styles.subjectPillActive,
                ]}
                onPress={() => setSelectedSubject(s)}
              >
                <Text
                  style={[
                    styles.subjectPillText,
                    selectedSubject === s && styles.subjectPillTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={filteredClasses}
        keyExtractor={(item) => item.id}
        renderItem={renderClassItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#4F46E5']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Video size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Live Classes Found</Text>
            <Text style={styles.emptySubtitle}>
              When your instructor launches a class or schedules a session for your batch, it will appear here.
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
  liveCountSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  statusTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  statusTab: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  statusTabActive: {
    backgroundColor: '#4F46E5',
  },
  statusTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  statusTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectBar: {
    paddingVertical: 8,
  },
  subjectScroll: {
    paddingHorizontal: 20,
    gap: 6,
  },
  subjectPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  subjectPillActive: {
    backgroundColor: '#312E81',
    borderColor: '#312E81',
  },
  subjectPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  subjectPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 20,
    gap: 14,
  },
  classCard: {
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
  classCardActive: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  subjectPillBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#047857',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34D399',
  },
  liveIndicatorText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scheduledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  scheduledBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  endedBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  endedBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  classTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 12,
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
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 10,
    height: 44,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  watchRecordingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    height: 44,
  },
  watchRecordingBtnText: {
    color: '#16A34A',
    fontSize: 13,
    fontWeight: '700',
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
    maxWidth: 260,
  },
});

