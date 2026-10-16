import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  ArrowLeft,
  FileQuestion,
  KeyRound,
  Mail,
  User as UserIcon,
  PlayCircle,
  HelpCircle,
} from 'lucide-react-native';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { AuthStackParamList, ExamTest } from '../../types';

type Props = NativeStackScreenProps<AuthStackParamList, 'GuestExamJoin'>;

export const GuestExamJoinScreen: React.FC<Props> = ({ navigation, route }) => {
  const { loginGuestForExam } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [testId, setTestId] = useState(route.params?.testId || '');
  const [passcode, setPasscode] = useState(route.params?.passcode || '');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [availableTests, setAvailableTests] = useState<ExamTest[]>([]);
  const [fetchingTests, setFetchingTests] = useState(true);

  // Fetch published open passcode tests
  useEffect(() => {
    const fetchOpenTests = async () => {
      try {
        const q = query(collection(db, 'examTests'), orderBy('startAt', 'desc'));
        const snap = await getDocs(q);
        const list: ExamTest[] = snap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((t) => t.accessPasswordHash && !t.manuallyClosedAt && t.status !== 'draft');
        setAvailableTests(list);
      } catch (err) {
        console.warn('[GUEST] Error fetching open tests:', err);
      } finally {
        setFetchingTests(false);
      }
    };
    fetchOpenTests();
  }, []);

  const handleJoin = async () => {
    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!testId.trim()) {
      setErrorMessage('Please select or enter a valid Test ID.');
      return;
    }

    setErrorMessage(null);
    setLoading(true);
    try {
      const res = await loginGuestForExam({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        testId: testId.trim(),
        passcode: passcode.trim(),
      });

      if (!res.success) {
        setErrorMessage(res.error || 'Could not verify test entry credentials.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error joining examination.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <ArrowLeft size={22} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Guest CBT Exam Portal</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Institute Official Banner Header */}
          <View style={styles.brandingHeader}>
            <Image
              source={require('../../../assets/banner.jpeg')}
              style={styles.bannerImage}
              resizeMode="contain"
            />
          </View>

          {/* Info Card */}
          <View style={styles.infoBox}>
            <HelpCircle size={20} color="#4F46E5" />
            <Text style={styles.infoText}>
              Participate in institute mock tests without full portal enrollment. Please provide accurate details for your test scorecard.
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Form */}
          <View style={styles.formCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Candidate Full Name *</Text>
              <View style={styles.inputWrapper}>
                <UserIcon size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Rahul Sharma"
                  placeholderTextColor="#94A3B8"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address *</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="e.g. rahul@example.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Examination ID *</Text>
              <View style={styles.inputWrapper}>
                <FileQuestion size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter Test ID"
                  placeholderTextColor="#94A3B8"
                  value={testId}
                  onChangeText={setTestId}
                  autoCapitalize="none"
                />
              </View>
            </View>

            {/* Quick selector of open tests if available */}
            {availableTests.length > 0 ? (
              <View style={styles.openTestsContainer}>
                <Text style={styles.openTestsLabel}>Available Public Mock Tests:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.openTestsScroll}>
                  {availableTests.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={[
                        styles.testChip,
                        testId === t.id && styles.testChipSelected,
                      ]}
                      onPress={() => setTestId(t.id)}
                    >
                      <Text
                        style={[
                          styles.testChipText,
                          testId === t.id && styles.testChipTextSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {t.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Exam Access Passcode</Text>
              <View style={styles.inputWrapper}>
                <KeyRound size={18} color="#94A3B8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Provided by administrator"
                  placeholderTextColor="#94A3B8"
                  value={passcode}
                  onChangeText={setPasscode}
                  secureTextEntry
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.joinBtn, loading && styles.joinBtnDisabled]}
              onPress={handleJoin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <PlayCircle size={20} color="#FFFFFF" />
                  <Text style={styles.joinBtnText}>Start Examination</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  scrollContent: {
    padding: 20,
  },
  brandingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerImage: {
    width: '100%',
    height: 60,
    borderRadius: 8,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#3730A3',
    lineHeight: 18,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  inputGroup: {},
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 15,
    color: '#0F172A',
  },
  openTestsContainer: {
    marginVertical: 4,
  },
  openTestsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  openTestsScroll: {
    flexDirection: 'row',
  },
  testChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    maxWidth: 220,
  },
  testChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  testChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  testChipTextSelected: {
    color: '#FFFFFF',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    height: 50,
    marginTop: 8,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  joinBtnDisabled: {
    opacity: 0.6,
  },
  joinBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

