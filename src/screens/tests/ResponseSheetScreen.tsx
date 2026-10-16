import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Shield } from 'lucide-react-native';
import { WebView } from 'react-native-webview';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { ExamAttempt, ExamQuestion, ExamQuestionPrivate, ExamTest, RootStackParamList } from '../../types';

type Props = NativeStackScreenProps<RootStackParamList, 'ResponseSheet'>;

export const ResponseSheetScreen: React.FC<Props> = ({ navigation, route }) => {
  const { testId, attemptId } = route.params;
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [htmlContent, setHtmlContent] = useState<string>('');

  useEffect(() => {
    const buildSheet = async () => {
      const uid = attemptId || user?.id;
      if (!testId || !uid) return;

      try {
        const [testSnap, attemptSnap, qSnap] = await Promise.all([
          getDoc(doc(db, 'examTests', testId)),
          getDoc(doc(db, 'examTests', testId, 'attempts', uid)),
          getDocs(collection(db, 'examTests', testId, 'questionsPublic')),
        ]);

        const test = testSnap.data() as ExamTest;
        const attempt = attemptSnap.data() as ExamAttempt;
        const questions: ExamQuestion[] = qSnap.docs.map((d) => ({
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
        questions.sort((a, b) => (a.questionNo ?? 0) - (b.questionNo ?? 0));

        let keys: ExamQuestionPrivate[] = [];
        try {
          const kSnap = await getDocs(
            collection(db, 'examTests', testId, 'questionsPrivate')
          );
          keys = kSnap.docs.map((d) => ({
            id: d.id,
            correctIndex: d.data().correctIndex,
            numericalAnswer: d.data().numericalAnswer,
          }));
        } catch {}

        const keyMap = new Map<string, ExamQuestionPrivate>();
        keys.forEach((k) => keyMap.set(k.id, k));

        const studentName = attempt?.participantName || user?.name || 'Student';
        const studentId = user?.studentId || user?.email || attempt?.uid || '-';
        const submittedDate = attempt?.submittedAt
          ? new Date(attempt.submittedAt).toLocaleString('en-IN')
          : 'In Progress';
        const totalMarks = attempt?.score ?? 0;
        const maxMarks = attempt?.maxScore ?? test?.totalMarks ?? questions.length * 4;

        const optionLetters = ['A', 'B', 'C', 'D', 'E'];

        // Generate clean HTML response sheet
        const rowsHtml = questions
          .map((q, idx) => {
            const candidateAns = attempt?.answers?.[q.id];
            const isUnanswered = candidateAns === null || candidateAns === undefined || candidateAns === '';
            const key = keyMap.get(q.id);

            let status = 'Unanswered';
            let statusColor = '#64748B';
            let givenAnsText = 'Not Answered';
            let correctAnsText = '-';

            if (key) {
              correctAnsText =
                q.type === 'numerical'
                  ? String(key.numericalAnswer)
                  : `Option ${optionLetters[key.correctIndex ?? 0] || (key.correctIndex ?? 0) + 1}`;
            }

            if (!isUnanswered) {
              givenAnsText =
                q.type === 'numerical'
                  ? String(candidateAns)
                  : `Option ${optionLetters[candidateAns] || candidateAns + 1}`;

              if (key) {
                const isCorrect =
                  q.type === 'numerical'
                    ? String(candidateAns).trim() === String(key.numericalAnswer ?? '').trim()
                    : candidateAns === key.correctIndex;

                if (isCorrect) {
                  status = 'Correct';
                  statusColor = '#10B981';
                } else {
                  status = 'Wrong';
                  statusColor = '#EF4444';
                }
              } else {
                status = 'Answered';
                statusColor = '#4F46E5';
              }
            }

            return `
              <tr>
                <td style="text-align: center; font-weight: bold; padding: 10px 8px; border: 1px solid #CBD5E1;">${idx + 1}</td>
                <td style="padding: 10px 8px; border: 1px solid #CBD5E1;">
                  <div style="font-weight: 600; color: #1E293B; margin-bottom: 4px;">${q.text.replace(/</g, '&lt;')}</div>
                  ${q.imageUrl ? `<img src="${q.imageUrl}" style="max-width: 100%; max-height: 120px; border-radius: 4px; margin-top: 4px;" />` : ''}
                </td>
                <td style="padding: 10px 8px; border: 1px solid #CBD5E1; text-align: center; font-weight: 600;">${givenAnsText}</td>
                <td style="padding: 10px 8px; border: 1px solid #CBD5E1; text-align: center; font-weight: 700; color: #10B981;">${correctAnsText}</td>
                <td style="padding: 10px 8px; border: 1px solid #CBD5E1; text-align: center;">
                  <span style="background-color: ${statusColor}18; color: ${statusColor}; font-weight: 700; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                    ${status}
                  </span>
                </td>
              </tr>
            `;
          })
          .join('');

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                  margin: 0;
                  padding: 16px;
                  background: #FFFFFF;
                  color: #0F172A;
                  font-size: 13px;
                }
                .sheet-header {
                  text-align: center;
                  border-bottom: 2px solid #4F46E5;
                  padding-bottom: 14px;
                  margin-bottom: 16px;
                }
                .institute-name {
                  font-size: 20px;
                  font-weight: 900;
                  color: #4F46E5;
                  letter-spacing: -0.5px;
                }
                .sub-title {
                  font-size: 13px;
                  font-weight: 700;
                  color: #334155;
                  margin-top: 2px;
                }
                .candidate-card {
                  background: #F8FAFC;
                  border: 1px solid #E2E8F0;
                  border-radius: 8px;
                  padding: 12px 16px;
                  margin-bottom: 16px;
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: 8px;
                }
                .info-item {
                  font-size: 12px;
                }
                .info-label {
                  color: #64748B;
                  font-weight: 600;
                }
                .info-val {
                  font-weight: 700;
                  color: #0F172A;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 12px;
                }
                th {
                  background-color: #EEF2FF;
                  color: #3730A3;
                  padding: 8px;
                  border: 1px solid #CBD5E1;
                  font-weight: 700;
                }
              </style>
            </head>
            <body>
              <div class="sheet-header">
                <div class="institute-name">KARTHIKEYAN ANALYSIS</div>
                <div class="sub-title">CANDIDATE OFFICIAL CBT RESPONSE SHEET</div>
              </div>

              <div class="candidate-card">
                <div class="info-item"><span class="info-label">Candidate:</span> <span class="info-val">${studentName}</span></div>
                <div class="info-item"><span class="info-label">Student ID:</span> <span class="info-val">${studentId}</span></div>
                <div class="info-item"><span class="info-label">Examination:</span> <span class="info-val">${test?.title || ''}</span></div>
                <div class="info-item"><span class="info-label">Submitted:</span> <span class="info-val">${submittedDate}</span></div>
                <div class="info-item"><span class="info-label">Score Obtained:</span> <span class="info-val" style="color: #4F46E5;">${totalMarks} / ${maxMarks}</span></div>
                <div class="info-item"><span class="info-label">Correct / Wrong:</span> <span class="info-val">${attempt?.correctCount || 0} / ${attempt?.wrongCount || 0}</span></div>
              </div>

              <table>
                <thead>
                  <tr>
                    <th style="width: 36px;">Q.No</th>
                    <th>Question Statement</th>
                    <th style="width: 80px;">Given Answer</th>
                    <th style="width: 80px;">Key</th>
                    <th style="width: 70px;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </body>
          </html>
        `;

        setHtmlContent(html);
      } catch (err) {
        console.error('[RESPONSE_SHEET] Error building sheet:', err);
      } finally {
        setLoading(false);
      }
    };

    buildSheet();
  }, [testId, attemptId, user?.id]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Official Response Sheet</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading official response sheet...</Text>
        </View>
      ) : (
        <WebView
          source={{ html: htmlContent }}
          style={styles.webview}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
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
  webview: {
    flex: 1,
  },
});

