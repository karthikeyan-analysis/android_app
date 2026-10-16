import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { PaletteStatus } from '../types';
import { X } from 'lucide-react-native';

interface QuestionPaletteModalProps {
  visible: boolean;
  onClose: () => void;
  totalQuestions: number;
  currentIndex: number;
  onSelectQuestion: (index: number) => void;
  paletteStatus: Record<string, PaletteStatus>;
  questionIds: string[];
  onSubmit: () => void;
}

export const QuestionPaletteModal: React.FC<QuestionPaletteModalProps> = ({
  visible,
  onClose,
  totalQuestions,
  currentIndex,
  onSelectQuestion,
  paletteStatus,
  questionIds,
  onSubmit,
}) => {
  // Count counts
  let answered = 0;
  let notAnswered = 0;
  let notVisited = 0;
  let markedForReview = 0;
  let answeredAndMarked = 0;

  questionIds.forEach((id) => {
    const st = paletteStatus[id] || 'not_visited';
    if (st === 'answered') answered++;
    else if (st === 'not_answered') notAnswered++;
    else if (st === 'marked_for_review') markedForReview++;
    else if (st === 'answered_marked') answeredAndMarked++;
    else notVisited++;
  });

  const getStatusColor = (status: PaletteStatus) => {
    switch (status) {
      case 'answered':
        return { bg: '#10B981', text: '#FFFFFF', border: '#059669' };
      case 'not_answered':
        return { bg: '#EF4444', text: '#FFFFFF', border: '#DC2626' };
      case 'marked_for_review':
        return { bg: '#8B5CF6', text: '#FFFFFF', border: '#7C3AED' };
      case 'answered_marked':
        return { bg: '#6366F1', text: '#FFFFFF', border: '#4F46E5' };
      case 'not_visited':
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Question Palette</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={22} color="#475569" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary Pills */}
          <View style={styles.legendContainer}>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendCircle, { backgroundColor: '#10B981' }]} />
                <Text style={styles.legendText}>Answered ({answered})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendCircle, { backgroundColor: '#EF4444' }]} />
                <Text style={styles.legendText}>Not Answered ({notAnswered})</Text>
              </View>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendCircle, { backgroundColor: '#8B5CF6' }]} />
                <Text style={styles.legendText}>Marked Review ({markedForReview})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendCircle, { backgroundColor: '#6366F1' }]} />
                <Text style={styles.legendText}>Ans & Review ({answeredAndMarked})</Text>
              </View>
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendCircle, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1 }]} />
                <Text style={styles.legendText}>Not Visited ({notVisited})</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Choose a Question</Text>

          {/* Grid of question buttons */}
          <View style={styles.grid}>
            {questionIds.map((qid, idx) => {
              const status = paletteStatus[qid] || 'not_visited';
              const colors = getStatusColor(status);
              const isCurrent = idx === currentIndex;

              return (
                <TouchableOpacity
                  key={qid}
                  style={[
                    styles.qButton,
                    {
                      backgroundColor: colors.bg,
                      borderColor: isCurrent ? '#F59E0B' : colors.border,
                      borderWidth: isCurrent ? 3 : 1,
                    },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelectQuestion(idx);
                    onClose();
                  }}
                >
                  <Text style={[styles.qButtonText, { color: colors.text }]}>
                    {idx + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.submitBtn}
            activeOpacity={0.8}
            onPress={() => {
              onClose();
              onSubmit();
            }}
          >
            <Text style={styles.submitBtnText}>Submit Examination</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  legendContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  legendCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 24,
  },
  qButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  qButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  submitBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

