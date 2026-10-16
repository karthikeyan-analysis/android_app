export type UserRole = 'student';

export interface StudentBatchFields {
  batchId?: string | null;
  batchIds?: string[] | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  studentId?: string;
  batchId?: string;
  batchIds?: string[];
  studentRecordId?: string;
  photoURL?: string;
  isGuestExamParticipant?: boolean;
  guestExamTestId?: string;
}

export interface StudentDoc {
  id?: string;
  name?: string;
  email?: string;
  studentId?: string;
  portalUsername?: string;
  portalPassword?: string;
  batchId?: string;
  batchIds?: string[];
  photoURL?: string;
  activeSessionToken?: string;
  activeDevice?: string;
  activeDeviceLoginAt?: string;
  status?: string;
  approvalStatus?: string;
}

export interface Batch {
  id: string;
  name: string;
  description?: string;
  subjects?: string[];
  schedule?: string;
}

export interface ContentItem {
  id: string;
  title: string;
  description?: string;
  type: 'pdf' | 'doc' | 'note';
  fileUrl: string;
  subject?: string;
  batchId?: string;
  batchIds?: string[];
  visibilityType: 'ALL' | 'SELECTIVE' | 'BATCH';
  selectedStudents?: string[];
  uploadDate?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  thumbnail?: string;
  duration?: number;
  subject?: string;
  batchId?: string;
  batchIds?: string[];
  visibilityType: 'ALL' | 'SELECTIVE' | 'BATCH';
  selectedStudents?: string[];
  uploadDate?: string;
  isLiveRecording?: boolean;
  classId?: string;
}

export interface ExamPart {
  id: string;
  name: string;
  totalQuestions?: number;
  maxToAttempt?: number;
  marksPerQuestion?: number;
  negativeMarks?: number;
  isOptional?: boolean;
}

export type ExamShowAnswersAfter = 'immediate' | 'after_end' | 'never';

export interface ExamTest {
  id: string;
  title: string;
  description?: string;
  batchId?: string;
  batchIds?: string[];
  subject?: string;
  partsMode?: 'single' | 'multi';
  parts?: ExamPart[];
  durationMinutes: number;
  totalQuestions?: number;
  totalMarks?: number;
  defaultMarksPerQuestion?: number;
  negativeMarkPerWrong?: number;
  startAt: string;
  endAt: string;
  accessPasswordHash?: string;
  showAnswersAfter?: ExamShowAnswersAfter;
  status?: 'draft' | 'published' | 'completed' | 'closed';
  visibility?: 'ALL' | 'SELECTIVE' | 'BATCH';
  selectedStudentRecordIds?: string[];
  manuallyClosedAt?: string;
  pausedUids?: string[];
}

export interface ExamQuestion {
  id: string;
  questionNo: number;
  text: string;
  imageUrl?: string;
  options: string[];
  type?: 'single' | 'multi' | 'numerical';
  marks?: number;
  negativeMarks?: number;
  partId?: string;
  solution?: string;
  solutionImageUrl?: string;
}

export interface ExamQuestionPrivate {
  id: string;
  correctIndex?: number;
  correctIndices?: number[];
  numericalAnswer?: string | number;
  solution?: string;
  solutionImageUrl?: string;
}

export interface ExamAttempt {
  id?: string;
  uid: string;
  testId: string;
  batchId?: string;
  studentRecordId?: string;
  participantName?: string;
  participantEmail?: string;
  isGuest?: boolean;
  startedAt: string;
  submittedAt?: string;
  hardEndAt?: string;
  lastSavedAt?: string;
  status: 'in_progress' | 'submitted';
  answers: Record<string, any>;
  markedForReview: string[];
  questionIds?: string[];
  score?: number;
  maxScore?: number;
  correctCount?: number;
  wrongCount?: number;
  unansweredCount?: number;
  strikes?: number;
  partResults?: Record<string, {
    score: number;
    maxScore: number;
    attempted: number;
    correct: number;
    wrong: number;
  }>;
}

export interface LiveClass {
  id: string;
  name: string;
  subject?: string;
  batchId?: string;
  batchIds?: string[];
  status: 'scheduled' | 'active' | 'ended';
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  instructorName?: string;
  recordingDownloadUrl?: string;
  recordingKey?: string;
  recordings?: Array<{
    id: string;
    name?: string;
    downloadUrl?: string;
    key?: string;
    durationSec?: number;
    createdAt?: string;
  }>;
  liveTestActive?: boolean;
  liveTestId?: string;
}

export interface LiveClassDoubt {
  id: string;
  studentUid: string;
  studentName: string;
  question: string;
  answer?: string;
  status: 'pending' | 'answered';
  createdAt: string;
  answeredAt?: string;
}

export type PaletteStatus =
  | 'not_visited'
  | 'not_answered'
  | 'answered'
  | 'marked_for_review'
  | 'answered_marked';

export type AuthStackParamList = {
  Login: undefined;
  GuestExamJoin: { testId?: string; passcode?: string } | undefined;
};

export type MainTabParamList = {
  DashboardTab: undefined;
  MediaTab: { preselectedSubject?: string } | undefined;
  TestsTab: undefined;
  LiveClassesTab: { subject?: string } | undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  BatchSelection: undefined;
  MainTabs: undefined;
  PdfViewer: { contentId: string; title: string; fileUrl: string; description?: string };
  VideoPlayer: { videoId: string; title: string; videoUrl: string; description?: string; isLiveRecording?: boolean };
  TakeExam: { testId: string; title?: string };
  ExamResult: { testId: string; attemptId?: string };
  ResponseSheet: { testId: string; attemptId?: string };
  LiveClassRoom: { classId: string; title?: string; subject?: string };
};
