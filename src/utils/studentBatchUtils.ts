import AsyncStorage from '@react-native-async-storage/async-storage';
import { StudentBatchFields } from '../types';

export function normalizeStudentBatchIds(
  input: { batchId?: string | null; batchIds?: string[] | null } | null | undefined,
): string[] {
  const fromArray = (input?.batchIds || [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  if (fromArray.length) return [...new Set(fromArray)];
  const legacy = String(input?.batchId || '').trim();
  return legacy ? [legacy] : [];
}

export function studentBatchWriteFields(
  batchIds: string[],
  preferredActive?: string | null,
): { batchId: string | null; batchIds: string[] } {
  const unique = [...new Set(batchIds.map((id) => String(id || '').trim()).filter(Boolean))];
  if (!unique.length) return { batchId: null, batchIds: [] };
  const preferred = String(preferredActive || '').trim();
  const active = preferred && unique.includes(preferred) ? preferred : unique[0];
  return { batchId: active, batchIds: unique };
}

export function activeBatchStorageKey(studentRecordId: string) {
  return `@ka_active_batch_${studentRecordId}`;
}

export async function readStoredActiveBatch(studentRecordId: string): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(activeBatchStorageKey(studentRecordId));
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export async function writeStoredActiveBatch(studentRecordId: string, batchId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(activeBatchStorageKey(studentRecordId), batchId);
  } catch {
    // Ignore storage errors
  }
}

export async function clearStoredActiveBatch(studentRecordId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(activeBatchStorageKey(studentRecordId));
  } catch {
    // Ignore storage errors
  }
}

export async function resolveActiveBatchId(params: {
  batchIds: string[];
  studentRecordId: string;
  preferredFromUserDoc?: string | null;
}): Promise<string | undefined> {
  const { batchIds, studentRecordId, preferredFromUserDoc } = params;
  if (!batchIds.length) return undefined;
  if (batchIds.length === 1) return batchIds[0];

  const stored = await readStoredActiveBatch(studentRecordId);
  if (stored && batchIds.includes(stored)) return stored;

  const fromUser = String(preferredFromUserDoc || '').trim();
  if (fromUser && batchIds.includes(fromUser)) return fromUser;

  return undefined;
}

