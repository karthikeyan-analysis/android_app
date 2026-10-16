import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  ReactNode,
} from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  doc,
  getDocs,
} from 'firebase/firestore';

import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import {
  Batch,
  ContentItem,
  VideoItem,
  ExamTest,
  LiveClass,
} from '../types';

interface DataContextType {
  batches: Batch[];
  currentBatch: Batch | null;
  content: ContentItem[];
  videos: VideoItem[];
  tests: ExamTest[];
  liveClasses: LiveClass[];
  loading: boolean;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [tests, setTests] = useState<ExamTest[]>([]);
  const [liveClasses, setLiveClasses] = useState<LiveClass[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Subscribe to all batches
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'batches'),
      (snapshot) => {
        const list: Batch[] = snapshot.docs.map((d) => ({
          id: d.id,
          name: d.data().name || 'Batch',
          description: d.data().description,
          subjects: d.data().subjects || [],
          schedule: d.data().schedule,
        }));
        setBatches(list);
      },
      (err) => console.warn('[DATA] Batches subscription error:', err)
    );
    return () => unsub();
  }, []);

  const currentBatch = useMemo(() => {
    if (!user?.batchId) return null;
    return batches.find((b) => b.id === user.batchId) || null;
  }, [batches, user?.batchId]);

  // Subscribe to content (PDFs/Notes)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'content'),
      (snapshot) => {
        const list: ContentItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || 'Untitled Document',
            description: data.description,
            type: data.type || 'pdf',
            fileUrl: data.fileUrl || '',
            subject: data.subject,
            batchId: data.batchId,
            batchIds: data.batchIds,
            visibilityType: data.visibilityType || 'ALL',
            selectedStudents: data.selectedStudents || [],
            uploadDate: data.uploadDate || data.createdAt,
          };
        });
        setContent(list);
      },
      (err) => console.warn('[DATA] Content subscription error:', err)
    );
    return () => unsub();
  }, []);

  // Subscribe to videos
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'videos'),
      (snapshot) => {
        const list: VideoItem[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || 'Untitled Video',
            description: data.description,
            videoUrl: data.videoUrl || '',
            thumbnail: data.thumbnail,
            duration: data.duration,
            subject: data.subject,
            batchId: data.batchId,
            batchIds: data.batchIds,
            visibilityType: data.visibilityType || 'ALL',
            selectedStudents: data.selectedStudents || [],
            uploadDate: data.uploadDate || data.createdAt,
          };
        });
        setVideos(list);
      },
      (err) => console.warn('[DATA] Videos subscription error:', err)
    );
    return () => unsub();
  }, []);

  // Subscribe to tests for student batch
  useEffect(() => {
    const activeBatch = user?.batchId;
    const unsub = onSnapshot(
      collection(db, 'examTests'),
      (snapshot) => {
        const list: ExamTest[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: data.title || 'Test',
            description: data.description,
            batchId: data.batchId,
            batchIds: data.batchIds,
            subject: data.subject,
            partsMode: data.partsMode,
            parts: data.parts,
            durationMinutes: data.durationMinutes || 60,
            totalQuestions: data.totalQuestions,
            totalMarks: data.totalMarks,
            defaultMarksPerQuestion: data.defaultMarksPerQuestion,
            negativeMarkPerWrong: data.negativeMarkPerWrong,
            startAt: data.startAt || '',
            endAt: data.endAt || '',
            accessPasswordHash: data.accessPasswordHash,
            showAnswersAfter: data.showAnswersAfter || 'immediate',
            status: data.status || 'published',
            visibility: data.visibility || 'ALL',
            selectedStudentRecordIds: data.selectedStudentRecordIds || [],
            manuallyClosedAt: data.manuallyClosedAt,
            pausedUids: data.pausedUids,
          };
        });

        // Filter tests visible to student
        const filtered = list.filter((t) => {
          if (t.status === 'draft') return false;
          if (user?.isGuestExamParticipant) {
            return t.id === user.guestExamTestId;
          }
          if (!activeBatch) return true;
          const belongsToBatch =
            t.batchId === activeBatch ||
            (Array.isArray(t.batchIds) && t.batchIds.includes(activeBatch));
          if (!belongsToBatch && t.visibility !== 'ALL') return false;
          if (t.visibility === 'SELECTIVE' && user.studentRecordId) {
            return t.selectedStudentRecordIds?.includes(user.studentRecordId);
          }
          return true;
        });

        filtered.sort(
          (a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime()
        );

        setTests(filtered);
        setLoading(false);
      },
      (err) => {
        console.warn('[DATA] Exam tests subscription error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.batchId, user?.isGuestExamParticipant, user?.guestExamTestId, user?.studentRecordId]);

  // Subscribe to Live Classes
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'liveClasses'),
      (snapshot) => {
        const activeBatch = user?.batchId;
        const list: LiveClass[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || 'Live Class',
            subject: data.subject,
            batchId: data.batchId,
            batchIds: data.batchIds,
            status: data.status || 'scheduled',
            scheduledAt: data.scheduledAt,
            startedAt: data.startedAt,
            endedAt: data.endedAt,
            instructorName: data.instructorName,
            recordingDownloadUrl: data.recordingDownloadUrl,
            recordingKey: data.recordingKey,
            recordings: data.recordings,
            liveTestActive: data.liveTestActive === true,
            liveTestId: data.liveTestId,
          };
        });

        const filtered = list.filter((cls) => {
          if (!activeBatch) return true;
          return (
            cls.batchId === activeBatch ||
            (Array.isArray(cls.batchIds) && cls.batchIds.includes(activeBatch))
          );
        });

        setLiveClasses(filtered);
      },
      (err) => console.warn('[DATA] Live classes subscription error:', err)
    );
    return () => unsub();
  }, [user?.batchId]);

  const refreshData = async () => {
    // Force re-fetch if needed
  };

  return (
    <DataContext.Provider
      value={{
        batches,
        currentBatch,
        content,
        videos,
        tests,
        liveClasses,
        loading,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

