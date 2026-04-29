import type { AppStateSnapshot, ExamSession, PracticeLogEntry, PracticeStats } from '@/types';
import { STORAGE_KEYS } from './constants';
import { genId } from './utils';
import {
  ensurePracticeLogConsistency,
  normalizePracticeLogEntry,
  normalizeSubjects,
  repairStoredQuestionReferences
} from './migrations';

export function safeSetItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`localStorage 写入失败: ${key}`, error);
    return false;
  }
}

export function parseStorageJSON<T>(key: string, fallbackValue: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallbackValue;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`localStorage 数据损坏: ${key}`, error);
    return fallbackValue;
  }
}

export function loadAppState(): AppStateSnapshot {
  let migratedLegacyQuestions = 0;
  let subjects = normalizeSubjects(parseStorageJSON<any[]>(STORAGE_KEYS.subjects, []));

  if (subjects.length === 0 && !localStorage.getItem(STORAGE_KEYS.subjects)) {
    const legacyQuestions = parseStorageJSON<any[] | null>(STORAGE_KEYS.legacyQuestions, null);
    if (Array.isArray(legacyQuestions) && legacyQuestions.length > 0) {
      const questions = normalizeSubjects([{ id: genId(), name: '网络安全', questions: legacyQuestions }])[0]?.questions || [];
      if (questions.length > 0) {
        migratedLegacyQuestions = questions.length;
        subjects = [{ id: genId(), name: '网络安全', questions }];
        safeSetItem(STORAGE_KEYS.subjects, JSON.stringify(subjects));
      }
    }
  }

  const examHistory = parseStorageJSON<any[]>(STORAGE_KEYS.examHistory, []);
  const consistency = ensurePracticeLogConsistency(
    parseStorageJSON<any[]>(STORAGE_KEYS.practiceLog, []),
    examHistory as any
  );

  let snapshot: AppStateSnapshot = {
    subjects,
    wrongQuestions: parseStorageJSON(STORAGE_KEYS.wrongQuestions, []),
    practiceStats: consistency.practiceStats,
    examHistory: examHistory as any,
    practiceLog: consistency.practiceLog,
    questionTags: parseStorageJSON(STORAGE_KEYS.questionTags, {}),
    favoriteQuestionIds: parseStorageJSON<any[]>(STORAGE_KEYS.favoriteQuestionIds, []).map(id => String(id)),
    browseAnswerMode: parseStorageJSON<string>(STORAGE_KEYS.browseAnswerMode, 'show') === 'hide' ? 'hide' : 'show',
    migratedLegacyQuestions,
    repairedQuestionIds: false
  };

  snapshot = repairStoredQuestionReferences(snapshot);
  persistLoadedState(snapshot);
  return snapshot;
}

function persistLoadedState(snapshot: AppStateSnapshot) {
  saveSubjects(snapshot.subjects);
  saveFavorites(snapshot.favoriteQuestionIds);
  saveQuestionTags(snapshot.questionTags);
  saveWrongQuestions(snapshot.wrongQuestions);
  saveExamHistory(snapshot.examHistory);
  savePracticeTracking(snapshot.practiceLog, snapshot.practiceStats);
}

export function saveSubjects(subjects: unknown): boolean {
  return safeSetItem(STORAGE_KEYS.subjects, JSON.stringify(subjects));
}

export function saveFavorites(favoriteQuestionIds: unknown): boolean {
  return safeSetItem(STORAGE_KEYS.favoriteQuestionIds, JSON.stringify(favoriteQuestionIds));
}

export function saveQuestionTags(questionTags: unknown): boolean {
  return safeSetItem(STORAGE_KEYS.questionTags, JSON.stringify(questionTags));
}

export function saveWrongQuestions(wrongQuestions: unknown): boolean {
  return safeSetItem(STORAGE_KEYS.wrongQuestions, JSON.stringify(wrongQuestions));
}

export function saveExamHistory(examHistory: unknown): boolean {
  return safeSetItem(STORAGE_KEYS.examHistory, JSON.stringify(examHistory));
}

export function saveBrowseAnswerMode(mode: 'show' | 'hide'): boolean {
  return safeSetItem(STORAGE_KEYS.browseAnswerMode, JSON.stringify(mode));
}

export function saveSidebarCollapsed(collapsed: boolean): boolean {
  return safeSetItem(STORAGE_KEYS.sidebarCollapsed, JSON.stringify(collapsed));
}

export function getSidebarCollapsed(): boolean {
  return parseStorageJSON<boolean>(STORAGE_KEYS.sidebarCollapsed, false) === true;
}

export function savePracticeTracking(practiceLog: PracticeLogEntry[], practiceStats?: PracticeStats): boolean {
  const normalized = practiceLog.map(normalizePracticeLogEntry).filter(Boolean) as PracticeLogEntry[];
  const stats = practiceStats || normalized.reduce(
    (acc, record) => {
      acc.practiced += record.totalQuestions;
      acc.correct += record.correct;
      return acc;
    },
    { total: 0, correct: 0, practiced: 0 }
  );
  const okLog = safeSetItem(STORAGE_KEYS.practiceLog, JSON.stringify(normalized));
  const okStats = safeSetItem(STORAGE_KEYS.practiceStats, JSON.stringify(stats));
  return okLog && okStats;
}

export function saveExamSession(session: ExamSession): void {
  sessionStorage.setItem(STORAGE_KEYS.currentExam, JSON.stringify({
    ...session,
    savedAt: Date.now()
  }));
}

export function restoreExamSession(): ExamSession | null {
  const saved = sessionStorage.getItem(STORAGE_KEYS.currentExam);
  if (!saved) return null;
  try {
    const session = JSON.parse(saved) as ExamSession;
    if (!Array.isArray(session.questions) || session.questions.length === 0) {
      clearExamSession();
      return null;
    }
    return session;
  } catch {
    clearExamSession();
    return null;
  }
}

export function clearExamSession(): void {
  sessionStorage.removeItem(STORAGE_KEYS.currentExam);
}
