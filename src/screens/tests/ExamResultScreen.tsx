import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Award,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ArrowLeft,
  FileText,
  ChevronRight,
  TrendingUp,
  Percent,
  Layers,
  Lock,
} from 'lucide-react-native';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  ExamAttempt,
  ExamQuestion,
  ExamQuestionPrivate,
  ExamTest,
  RootStackParamList,
} from '../../types';
import { MathFormulaView } from '../../components/MathFormulaView';

type Props = NativeStackScreenProps<RootStackParamList, 'ExamResult'>;

type ReviewFilter = 'all' | 'correct' | 'incorrect' | 'skipped';

export const ExamResultScreen: React.FC<Props> = ({ navigation, route }) => {
  const { testId, attemptId } = route.params;
  const { user } = useAuth();

  const [test, setTest] = useState<ExamTest | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [keys, setKeys] = useState<ExamQuestionPrivate[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>('all');

  useEffect(() => {
    const loadResult = async () => {
      const uid = attemptId || user?.id;
      if (!testId || !uid) return;

      try {
        const [testSnap, attemptSnap, qSnap] = await Promise.all([
          getDoc(doc(db, 'examTests', testId)),
          getDoc(doc(db, 'examTests', testId, 'attempts', uid)),
          getDocs(collection(db, 'examTests', testId, 'questionsPublic')),
        ]);

        if (testSnap.exists()) {
          setTest({ id: testSnap.id, ...(testSnap.data() as any) });
        }
        if (attemptSnap.exists()) {
          setAttempt({ id: attemptSnap.id, ...(attemptSnap.data() as any) });
        }

        const qList: ExamQuestion[] = qSnap.docs.map((d) => ({
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
        setQuestions(qList);
      } catch (err) {
        console.error('[RESULT] Error loading test result:', err);
      } finally {
        setLoading(false);
      }
    };

    loadResult();
  }, [testId, attemptId, user?.id]);

  // Check showAnswersAfter policy
  const canShowAnswers = useMemo(() => {
    if (!test || !attempt) return false;
    if (test.showAnswersAfter === 'never') return false;
    if (test.showAnswersAfter === 'after_end') {
      const endMs = new Date(test.endAt).getTime();
      return Date.now() >= endMs;
    }
    return true; // 'immediate'
  }, [test, attempt]);

  // Load private keys if answers can be shown
  useEffect(() => {
    if (!canShowAnswers || keys) return;

    const loadKeys = async () => {
      try {
        const kSnap = await getDocs(
          collection(db, 'examTests', testId, 'questionsPrivate')
        );
        const kList = kSnap.docs.map((d) => ({
          id: d.id,
          correctIndex: d.data().correctIndex,
          numericalAnswer: d.data().numericalAnswer,
          solution: d.data().solution,
          solutionImageUrl: d.data().solutionImageUrl,
        }));
        setKeys(kList);
      } catch (err) {
        console.warn('[RESULT] Private keys load warning:', err);
      }
    };
    loadKeys();
  }, [canShowAnswers, keys, testId]);

  const keyMap = useMemo(() => {
    const map = new Map<string, ExamQuestionPrivate>();
    if (keys) {
      keys.forEach((k) => map.set(k.id, k));
    }
    return map;
  }, [keys]);

  // Calculated stats
  const totalQuestions = questions.length;
  const score = attempt?.score ?? 0;
  const maxScore = attempt?.maxScore ?? test?.totalMarks ?? totalQuestions * 4;
  const correctCount = attempt?.correctCount ?? 0;
  const wrongCount = attempt?.wrongCount ?? 0;
  const unansweredCount =
    attempt?.unansweredCount ?? Math.max(0, totalQuestions - correctCount - wrongCount);
  const attemptedCount = correctCount + wrongCount;
  const accuracyPct = attemptedCount > 0 ? Math.round((correctCount / attemptedCount) * 100) : 0;

  // Filtered review list
  const filteredQuestions = useMemo(() => {
    if (filter === 'all') return questions;

    return questions.filter((q) => {
      const candidateAns = attempt?.answers?.[q.id];
      const privateKey = keyMap.get(q.id);
      const isUnanswered = candidateAns === null || candidateAns === undefined || candidateAns === '';

      if (filter === 'skipped') return isUnanswered;

      let isCorrect = false;
      if (q.type === 'numerical') {
        const expected = String(privateKey?.numericalAnswer ?? '').trim();
        isCorrect = String(candidateAns).trim() === expected;
      } else {
        isCorrect = candidateAns === privateKey?.correctIndex;
      }

      if (filter === 'correct') return !isUnanswered && isCorrect;
      if (filter === 'incorrect') return !isUnanswered && !isCorrect;
      return true;
    });
  }, [questions, attempt?.answers, keyMap, filter]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Generating scorecard...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.navigate('MainTabs')}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Examination Result</Text>
        <TouchableOpacity
          style={styles.responseSheetHeaderBtn}
          onPress={() => navigation.navigate('ResponseSheet', { testId, attemptId })}
          activeOpacity={0.7}
        >
          <FileText size={18} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {/* Institute Official Banner Header */}
        <View style={styles.bannerCard}>
          <Image
            source={require('../../../assets/banner.jpeg')}
            style={styles.bannerImage}
            resizeMode="contain"
          />
        </View>

        {/* Main Score Hero Card */}
        <View style={styles.scoreHero}>
          <Text style={styles.scoreHeroTestTitle} numberOfLines={1}>
            {test?.title}
          </Text>
          <Text style={styles.scoreHeroCandidate}>
            Candidate: {attempt?.participantName || user?.name || 'Student'}
          </Text>

          <View style={styles.scoreCircle}>
            <Text style={styles.scoreObtained}>{score}</Text>
            <Text style={styles.scoreMax}>/ {maxScore}</Text>
          </View>

          <Text style={styles.scoreVerdict}>
            {score > maxScore * 0.75
              ? 'Outstanding Performance! 🌟'
              : score > maxScore * 0.45
              ? 'Good Effort! Keep Practicing 👍'
              : 'Needs Improvement. Review Solutions 📖'}
          </Text>
        </View>

        {/* Breakdown Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <View style={[styles.statDot, { backgroundColor: '#4F46E5' }]} />
            <Text style={styles.statVal}>{accuracyPct}%</Text>
            <Text style={styles.statLbl}>Accuracy</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.statVal, { color: '#10B981' }]}>{correctCount}</Text>
            <Text style={styles.statLbl}>Correct</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statDot, { backgroundColor: '#EF4444' }]} />
            <Text style={[styles.statVal, { color: '#EF4444' }]}>{wrongCount}</Text>
            <Text style={styles.statLbl}>Incorrect</Text>
          </View>

          <View style={styles.statBox}>
            <View style={[styles.statDot, { backgroundColor: '#94A3B8' }]} />
            <Text style={styles.statVal}>{unansweredCount}</Text>
            <Text style={styles.statLbl}>Skipped</Text>
          </View>
        </View>

        {/* Response Sheet Banner Link */}
        <TouchableOpacity
          style={styles.responseSheetBanner}
          onPress={() => navigation.navigate('ResponseSheet', { testId, attemptId })}
          activeOpacity={0.8}
        >
          <View style={styles.responseSheetBannerLeft}>
            <FileText size={22} color="#4F46E5" />
            <View>
              <Text style={styles.responseSheetBannerTitle}>Official Candidate Response Sheet</Text>
              <Text style={styles.responseSheetBannerSub}>
                View question-by-question answer log & institute scorecard
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </TouchableOpacity>

        {/* Question Review Section */}
        <View style={styles.reviewHeader}>
          <Text style={styles.reviewTitle}>Question Solutions & Review</Text>
          {!canShowAnswers ? (
            <View style={styles.lockedPill}>
              <Lock size={12} color="#D97706" />
              <Text style={styles.lockedPillText}>Solutions Hidden by Admin</Text>
            </View>
          ) : null}
        </View>

        {canShowAnswers ? (
          <>
            {/* Filter Pills */}
            <View style={styles.filterBar}>
              {(['all', 'correct', 'incorrect', 'skipped'] as ReviewFilter[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, filter === f && styles.filterPillActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}
                  >
                    {f === 'all'
                      ? `All (${questions.length})`
                      : f === 'correct'
                      ? `Correct (${correctCount})`
                      : f === 'incorrect'
                      ? `Incorrect (${wrongCount})`
                      : `Skipped (${unansweredCount})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Questions List */}
            <View style={styles.questionsList}>
              {filteredQuestions.map((q, qIndex) => {
                const candidateAns = attempt?.answers?.[q.id];
                const isSkipped = candidateAns === null || candidateAns === undefined || candidateAns === '';
                const privateKey = keyMap.get(q.id);

                let isCorrect = false;
                if (!isSkipped && privateKey) {
                  if (q.type === 'numerical') {
                    isCorrect =
                      String(candidateAns).trim() ===
                      String(privateKey.numericalAnswer ?? '').trim();
                  } else {
                    isCorrect = candidateAns === privateKey.correctIndex;
                  }
                }

                const optionLetters = ['A', 'B', 'C', 'D', 'E'];

                return (
                  <View key={q.id} style={styles.reviewCard}>
                    <View style={styles.reviewCardTop}>
                      <Text style={styles.reviewQNo}>Q{q.questionNo || qIndex + 1}</Text>
                      {isSkipped ? (
                        <View style={[styles.statusTag, { backgroundColor: '#F1F5F9' }]}>
                          <Text style={[styles.statusTagText, { color: '#64748B' }]}>Skipped</Text>
                        </View>
                      ) : isCorrect ? (
                        <View style={[styles.statusTag, { backgroundColor: '#ECFDF5' }]}>
                          <CheckCircle2 size={13} color="#10B981" />
                          <Text style={[styles.statusTagText, { color: '#10B981' }]}>Correct</Text>
                        </View>
                      ) : (
                        <View style={[styles.statusTag, { backgroundColor: '#FEF2F2' }]}>
                          <XCircle size={13} color="#EF4444" />
                          <Text style={[styles.statusTagText, { color: '#EF4444' }]}>Incorrect</Text>
                        </View>
                      )}
                    </View>

                    {/* Question Statement */}
                    <MathFormulaView content={q.text} fontSize={14} />

                    {q.imageUrl ? (
                      <Image
                        source={{ uri: q.imageUrl }}
                        style={styles.reviewImage}
                        resizeMode="contain"
                      />
                    ) : null}

                    {/* Answer Key Comparison */}
                    <View style={styles.answerComparisonBox}>
                      <View style={styles.comparisonRow}>
                        <Text style={styles.comparisonLabel}>Your Response:</Text>
                        <Text
                          style={[
                            styles.comparisonValue,
                            isSkipped
                              ? { color: '#94A3B8' }
                              : isCorrect
                              ? { color: '#10B981' }
                              : { color: '#EF4444' },
                          ]}
                        >
                          {isSkipped
                            ? 'Not Attempted'
                            : q.type === 'numerical'
                            ? String(candidateAns)
                            : `Option ${optionLetters[candidateAns] || candidateAns + 1}`}
                        </Text>
                      </View>

                      {privateKey ? (
                        <View style={styles.comparisonRow}>
                          <Text style={styles.comparisonLabel}>Correct Answer:</Text>
                          <Text style={[styles.comparisonValue, { color: '#10B981', fontWeight: '800' }]}>
                            {q.type === 'numerical'
                              ? String(privateKey.numericalAnswer)
                              : `Option ${
                                  optionLetters[privateKey.correctIndex ?? 0] ||
                                  (privateKey.correctIndex ?? 0) + 1
                                }`}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Step-by-step Solution */}
                    {privateKey?.solution ? (
                      <View style={styles.solutionBox}>
                        <Text style={styles.solutionTitle}>Explanation / Solution:</Text>
                        <MathFormulaView
                          content={privateKey.solution}
                          fontSize={13}
                          textColor="#334155"
                        />
                        {privateKey.solutionImageUrl ? (
                          <Image
                            source={{ uri: privateKey.solutionImageUrl }}
                            style={styles.solutionImage}
                            resizeMode="contain"
                          />
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.hiddenNoticeBox}>
            <Text style={styles.hiddenNoticeTitle}>Solutions will be released later</Text>
            <Text style={styles.hiddenNoticeSubtitle}>
              According to the examination settings configured by the administrator, correct answer keys and detailed explanations will be visible after the exam submission window closes.
            </Text>
          </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  responseSheetHeaderBtn: {
    padding: 6,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  bannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: {
    width: '100%',
    height: 52,
    borderRadius: 6,
  },
  scoreHero: {
    backgroundColor: '#1E1B4B',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#1E1B4B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  scoreHeroTestTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scoreHeroCandidate: {
    fontSize: 12,
    color: '#A5B4FC',
    marginTop: 4,
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginVertical: 18,
  },
  scoreObtained: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  scoreMax: {
    fontSize: 20,
    fontWeight: '700',
    color: '#818CF8',
    marginLeft: 6,
  },
  scoreVerdict: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C7D2FE',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  statLbl: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  responseSheetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  responseSheetBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  responseSheetBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3730A3',
  },
  responseSheetBannerSub: {
    fontSize: 11,
    color: '#4F46E5',
    marginTop: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  lockedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  questionsList: {
    gap: 14,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  reviewCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewQNo: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  reviewImage: {
    width: '100%',
    height: 160,
    borderRadius: 8,
  },
  answerComparisonBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  comparisonLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  comparisonValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  solutionBox: {
    backgroundColor: '#EEF2FF',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
    gap: 6,
  },
  solutionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730A3',
  },
  solutionImage: {
    width: '100%',
    height: 140,
    borderRadius: 6,
    marginTop: 6,
  },
  hiddenNoticeBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  hiddenNoticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  hiddenNoticeSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
});

