import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Folder,
  FolderOpen,
  FileText,
  Film,
  PlayCircle,
  Eye,
  Search,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Video,
} from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { ContentItem, MainTabParamList, RootStackParamList, VideoItem } from '../../types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'MediaTab'>,
  NativeStackScreenProps<RootStackParamList>
>;

type MediaCategory = 'all' | 'documents' | 'videos' | 'recordings';

export const MediaLibraryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { user } = useAuth();
  const { content, videos, liveClasses, currentBatch } = useData();

  const initialSubject = route.params?.preselectedSubject;
  const [selectedSubject, setSelectedSubject] = useState<string>(initialSubject || 'all');
  const [activeCategory, setActiveCategory] = useState<MediaCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    [initialSubject || '']: true,
  });

  const toggleFolder = (sub: string) => {
    setOpenFolders((prev) => ({
      ...prev,
      [sub]: !prev[sub],
    }));
  };

  // Convert live class recordings to VideoItem format
  const liveClassRecordings: VideoItem[] = useMemo(() => {
    const list: VideoItem[] = [];
    liveClasses.forEach((cls) => {
      if (Array.isArray(cls.recordings) && cls.recordings.length > 0) {
        cls.recordings.forEach((r) => {
          if (r.downloadUrl) {
            list.push({
              id: r.id || `${cls.id}_${r.key}`,
              title: r.name ? `${cls.name} (${r.name})` : cls.name,
              videoUrl: r.downloadUrl,
              subject: cls.subject || 'Live Class Recording',
              description: `Recorded live session (${Math.round((r.durationSec || 0) / 60)} mins)`,
              uploadDate: r.createdAt || cls.endedAt,
              visibilityType: 'ALL',
              isLiveRecording: true,
              classId: cls.id,
            });
          }
        });
      } else if (cls.recordingDownloadUrl) {
        list.push({
          id: `rec_${cls.id}`,
          title: cls.name,
          videoUrl: cls.recordingDownloadUrl,
          subject: cls.subject || 'Live Class Recording',
          description: 'Recorded live class session',
          uploadDate: cls.endedAt,
          visibilityType: 'ALL',
          isLiveRecording: true,
          classId: cls.id,
        });
      }
    });
    return list;
  }, [liveClasses]);

  // Unique subjects
  const subjectsList = useMemo(() => {
    const set = new Set<string>();
    if (currentBatch?.subjects) {
      currentBatch.subjects.forEach((s) => s.trim() && set.add(s.trim()));
    }
    content.forEach((c) => c.subject && set.add(c.subject.trim()));
    videos.forEach((v) => v.subject && set.add(v.subject.trim()));
    liveClassRecordings.forEach((r) => r.subject && set.add(r.subject.trim()));
    return Array.from(set).sort();
  }, [currentBatch, content, videos, liveClassRecordings]);

  // Combined filtered items
  const itemsBySubject = useMemo(() => {
    const map: Record<string, { docs: ContentItem[]; vids: VideoItem[] }> = {};

    subjectsList.forEach((sub) => {
      map[sub] = { docs: [], vids: [] };
    });
    map['General'] = { docs: [], vids: [] };

    // Filter documents
    if (activeCategory === 'all' || activeCategory === 'documents') {
      content.forEach((item) => {
        const s = item.subject?.trim() || 'General';
        if (!map[s]) map[s] = { docs: [], vids: [] };
        if (
          !searchQuery.trim() ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          map[s].docs.push(item);
        }
      });
    }

    // Filter regular videos
    if (activeCategory === 'all' || activeCategory === 'videos') {
      videos.forEach((item) => {
        const s = item.subject?.trim() || 'General';
        if (!map[s]) map[s] = { docs: [], vids: [] };
        if (
          !searchQuery.trim() ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          map[s].vids.push(item);
        }
      });
    }

    // Filter live recordings
    if (activeCategory === 'all' || activeCategory === 'recordings') {
      liveClassRecordings.forEach((item) => {
        const s = item.subject?.trim() || 'General';
        if (!map[s]) map[s] = { docs: [], vids: [] };
        if (
          !searchQuery.trim() ||
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description?.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          map[s].vids.push(item);
        }
      });
    }

    return map;
  }, [subjectsList, content, videos, liveClassRecordings, activeCategory, searchQuery]);

  const activeSubjects = useMemo(() => {
    if (selectedSubject !== 'all') {
      return [selectedSubject];
    }
    return Object.keys(itemsBySubject).filter(
      (sub) => itemsBySubject[sub].docs.length > 0 || itemsBySubject[sub].vids.length > 0
    );
  }, [itemsBySubject, selectedSubject]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Study Materials & Media</Text>
        <View style={styles.secureBadge}>
          <Shield size={12} color="#4F46E5" />
          <Text style={styles.secureBadgeText}>DRM Protected</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={18} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes, chapters, topics..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Category Filter Pills */}
      <View style={styles.categoryBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {(['all', 'documents', 'videos', 'recordings'] as MediaCategory[]).map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryPill,
                activeCategory === cat && styles.categoryPillActive,
              ]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  activeCategory === cat && styles.categoryTextActive,
                ]}
              >
                {cat === 'all'
                  ? 'All Content'
                  : cat === 'documents'
                  ? 'PDF Notes'
                  : cat === 'videos'
                  ? 'Video Lessons'
                  : 'Live Recordings'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Subject Filter Bar */}
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
                styles.subjectText,
                selectedSubject === 'all' && styles.subjectTextActive,
              ]}
            >
              All Subjects
            </Text>
          </TouchableOpacity>

          {subjectsList.map((s) => (
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
                  styles.subjectText,
                  selectedSubject === s && styles.subjectTextActive,
                ]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Accordion List */}
      <ScrollView style={styles.contentList} contentContainerStyle={styles.contentListPadding}>
        {activeSubjects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Folder size={44} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Media Available</Text>
            <Text style={styles.emptySubtitle}>
              Materials will appear here as your faculty uploads lessons and study guides.
            </Text>
          </View>
        ) : (
          activeSubjects.map((sub) => {
            const group = itemsBySubject[sub] || { docs: [], vids: [] };
            const totalItems = group.docs.length + group.vids.length;
            const isOpen = openFolders[sub] ?? true;

            if (totalItems === 0) return null;

            return (
              <View key={sub} style={styles.subjectCard}>
                {/* Folder Header */}
                <TouchableOpacity
                  style={styles.folderHeader}
                  onPress={() => toggleFolder(sub)}
                  activeOpacity={0.7}
                >
                  <View style={styles.folderTitleRow}>
                    {isOpen ? (
                      <FolderOpen size={22} color="#4F46E5" />
                    ) : (
                      <Folder size={22} color="#4F46E5" />
                    )}
                    <Text style={styles.folderTitle}>{sub}</Text>
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{totalItems}</Text>
                    </View>
                  </View>
                  {isOpen ? (
                    <ChevronDown size={20} color="#64748B" />
                  ) : (
                    <ChevronRight size={20} color="#64748B" />
                  )}
                </TouchableOpacity>

                {/* Items in folder */}
                {isOpen ? (
                  <View style={styles.folderItems}>
                    {/* Documents */}
                    {group.docs.map((doc) => (
                      <TouchableOpacity
                        key={doc.id}
                        style={styles.itemRow}
                        onPress={() =>
                          navigation.navigate('PdfViewer', {
                            contentId: doc.id,
                            title: doc.title,
                            fileUrl: doc.fileUrl,
                            description: doc.description,
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View style={[styles.itemIconWrap, { backgroundColor: '#EEF2FF' }]}>
                          <FileText size={18} color="#4F46E5" />
                        </View>
                        <View style={styles.itemDetails}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {doc.title}
                          </Text>
                          <Text style={styles.itemMeta} numberOfLines={1}>
                            {doc.description || 'Study Material PDF'}
                          </Text>
                        </View>
                        <View style={styles.viewBadge}>
                          <Eye size={12} color="#4F46E5" />
                          <Text style={styles.viewBadgeText}>Read</Text>
                        </View>
                      </TouchableOpacity>
                    ))}

                    {/* Videos */}
                    {group.vids.map((vid) => (
                      <TouchableOpacity
                        key={vid.id}
                        style={styles.itemRow}
                        onPress={() =>
                          navigation.navigate('VideoPlayer', {
                            videoId: vid.id,
                            title: vid.title,
                            videoUrl: vid.videoUrl,
                            description: vid.description,
                            isLiveRecording: vid.isLiveRecording,
                          })
                        }
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.itemIconWrap,
                            {
                              backgroundColor: vid.isLiveRecording ? '#ECFDF5' : '#FEF3C7',
                            },
                          ]}
                        >
                          {vid.isLiveRecording ? (
                            <Film size={18} color="#059669" />
                          ) : (
                            <Video size={18} color="#D97706" />
                          )}
                        </View>
                        <View style={styles.itemDetails}>
                          <Text style={styles.itemTitle} numberOfLines={1}>
                            {vid.title}
                          </Text>
                          <Text style={styles.itemMeta} numberOfLines={1}>
                            {vid.description ||
                              (vid.isLiveRecording
                                ? 'Live Class Recording'
                                : 'Recorded Lecture')}
                          </Text>
                        </View>
                        <View style={[styles.viewBadge, { backgroundColor: '#F0FDF4' }]}>
                          <PlayCircle size={12} color="#16A34A" />
                          <Text style={[styles.viewBadgeText, { color: '#16A34A' }]}>Watch</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  secureBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4F46E5',
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#0F172A',
  },
  categoryBar: {
    paddingVertical: 10,
  },
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  categoryPillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subjectBar: {
    paddingBottom: 8,
  },
  subjectScroll: {
    paddingHorizontal: 20,
    gap: 6,
  },
  subjectPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  subjectPillActive: {
    backgroundColor: '#312E81',
  },
  subjectText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  subjectTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  contentList: {
    flex: 1,
  },
  contentListPadding: {
    padding: 20,
    gap: 14,
  },
  subjectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  folderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  folderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  folderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  countBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  folderItems: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  itemIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  viewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4F46E5',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
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
