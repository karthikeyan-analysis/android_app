import React, { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Layers, CheckCircle2, ArrowRight } from 'lucide-react-native';

import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'BatchSelection'>;

export const BatchSelectionScreen: React.FC<Props> = ({ navigation }) => {
  const { user, setActiveBatch } = useAuth();
  const { batches } = useData();
  const [selectedBatchId, setSelectedBatchId] = useState<string>(user?.batchId || '');
  const [saving, setSaving] = useState(false);

  const enrolledBatchIds = user?.batchIds?.length
    ? user.batchIds
    : user?.batchId
    ? [user.batchId]
    : [];

  const availableBatches = batches.filter((b) => enrolledBatchIds.includes(b.id));

  const handleContinue = async () => {
    if (!selectedBatchId) return;
    setSaving(true);
    try {
      await setActiveBatch(selectedBatchId);
      navigation.replace('MainTabs');
    } catch (err) {
      console.error('[BATCH] Error setting active batch:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Layers size={28} color="#4F46E5" />
        </View>
        <Text style={styles.title}>Select Your Active Batch</Text>
        <Text style={styles.subtitle}>
          You are enrolled in multiple coaching batches. Choose which batch syllabus and tests you want to access.
        </Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        {availableBatches.map((batch) => {
          const isSelected = selectedBatchId === batch.id;
          return (
            <TouchableOpacity
              key={batch.id}
              style={[styles.batchCard, isSelected && styles.batchCardSelected]}
              onPress={() => setSelectedBatchId(batch.id)}
              activeOpacity={0.8}
            >
              <View style={styles.cardHeader}>
                <Text style={[styles.batchName, isSelected && styles.batchNameSelected]}>
                  {batch.name}
                </Text>
                {isSelected ? (
                  <CheckCircle2 size={22} color="#4F46E5" />
                ) : (
                  <View style={styles.radioOuter} />
                )}
              </View>

              {batch.description ? (
                <Text style={styles.batchDesc}>{batch.description}</Text>
              ) : null}

              {batch.subjects && batch.subjects.length > 0 ? (
                <View style={styles.subjectsRow}>
                  {batch.subjects.slice(0, 4).map((sub, sIdx) => (
                    <View key={sIdx} style={styles.subjectBadge}>
                      <Text style={styles.subjectBadgeText}>{sub}</Text>
                    </View>
                  ))}
                  {batch.subjects.length > 4 ? (
                    <View style={styles.subjectBadge}>
                      <Text style={styles.subjectBadgeText}>+{batch.subjects.length - 4} more</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.continueBtn,
            (!selectedBatchId || saving) && styles.continueBtnDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedBatchId || saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.continueBtnText}>Enter Dashboard</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 16,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
  batchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  batchCardSelected: {
    borderColor: '#4F46E5',
    backgroundColor: '#F5F7FF',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  batchName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    marginRight: 8,
  },
  batchNameSelected: {
    color: '#4F46E5',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
  },
  batchDesc: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
  },
  subjectsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
  },
  subjectBadge: {
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  subjectBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 52,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  continueBtnDisabled: {
    opacity: 0.5,
  },
  continueBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

