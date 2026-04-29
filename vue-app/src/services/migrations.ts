import type {
  AppStateSnapshot,
  ExamRecord,
  PracticeLogEntry,
  PracticeStats,
  Question,
  QuestionTags,
  Subject,
  WrongQuestion
} from '@/types';
import { buildQuestionContentKey, genId, questionIdKey } from './utils';
import { normalizeImportedQuestion } from './validators';

export function normalizePracticeLogEntry(entry: any): PracticeLogEntry | null {
  const totalQuestions = Number(entry?.totalQuestions) || 0;
  if (totalQuestions <= 0) return null;

  const parsedDate = new Date(entry?.date || Date.now());
  const correct = Math.max(0, Math.min(totalQuestions, Number(entry?.correct) || 0));
  const rawMode = entry?.mode;
  const mode = rawMode === 'wrong' || rawMode === 'legacy' ? rawMode : 'exam';

  return {
    id: String(entry?.id || genId()),
    sessionId: String(entry?.sessionId || entry?.sourceExamRecordId || genId()),
    date: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
    subjectId: entry?.subjectId ? String(entry.subjectId) : '',
    subjectName: entry?.subjectName ? String(entry.subjectName) : '',
    totalQuestions,
    correct,
    mode,
    sourceExamRecordId: entry?.sourceExamRecordId ? String(entry.sourceExamRecordId) : ''
  };
}

export function buildPracticeLogEntriesFromExamRecord(record: ExamRecord): PracticeLogEntry[] {
  const sessionId = String(record.id || genId());
  if (Array.isArray(record.questions) && record.questions.some(question => question?.subjectId)) {
    const subjectSummary = new Map<string, any>();
    record.questions.forEach(question => {
      const subjectId = question?.subjectId ? String(question.subjectId) : '';
      if (!subjectId) return;
      const subjectName = question?.subjectName || '';
      if (!subjectSummary.has(subjectId)) {
        subjectSummary.set(subjectId, {
          id: genId(),
          sessionId,
          date: record.date,
          subjectId,
          subjectName,
          totalQuestions: 0,
          correct: 0,
          mode: 'exam',
          sourceExamRecordId: sessionId
        });
      }
      const summary = subjectSummary.get(subjectId);
      summary.totalQuestions += 1;
      if (question.userAnswer === question.correctAnswer) summary.correct += 1;
    });
    return [...subjectSummary.values()].map(normalizePracticeLogEntry).filter(Boolean) as PracticeLogEntry[];
  }

  const fallback = normalizePracticeLogEntry({
    id: genId(),
    sessionId,
    date: record.date,
    subjectId: record.subjectId,
    subjectName: record.subjectName,
    totalQuestions: Number(record.totalQuestions) || 0,
    correct: Number(record.correct) || 0,
    mode: 'exam',
    sourceExamRecordId: sessionId
  });
  return fallback ? [fallback] : [];
}

export function trimPracticeLog(records: PracticeLogEntry[]): PracticeLogEntry[] {
  const legacyRecords = records.filter(record => record.mode === 'legacy').slice(0, 1);
  const trackedRecords = records
    .filter(record => record.mode !== 'legacy')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 1000);
  return [...legacyRecords, ...trackedRecords];
}

export function getPracticeLogSummary(records: PracticeLogEntry[]): PracticeStats {
  const summary = records.reduce(
    (acc, record) => {
      acc.practiced += Number(record?.totalQuestions) || 0;
      acc.correct += Number(record?.correct) || 0;
      return acc;
    },
    { total: 0, correct: 0, practiced: 0 }
  );
  return summary;
}

export function ensurePracticeLogConsistency(
  rawPracticeLog: any[],
  examHistory: ExamRecord[]
): { practiceLog: PracticeLogEntry[]; practiceStats: PracticeStats } {
  let practiceLog = Array.isArray(rawPracticeLog)
    ? rawPracticeLog.map(normalizePracticeLogEntry).filter(Boolean) as PracticeLogEntry[]
    : [];

  if (practiceLog.length === 0) {
    practiceLog = examHistory.flatMap(record => buildPracticeLogEntriesFromExamRecord(record));
  }

  practiceLog = trimPracticeLog(practiceLog);
  return {
    practiceLog,
    practiceStats: getPracticeLogSummary(practiceLog)
  };
}

function mergeQuestionTags(targetTags: QuestionTags, questionId: string, tags: string[] = []) {
  const targetId = questionIdKey(questionId);
  const mergedTags = new Set(targetTags[targetId] || []);
  tags.forEach(tag => {
    if (tag) mergedTags.add(tag);
  });
  if (mergedTags.size > 0) targetTags[targetId] = [...mergedTags];
}

export function repairStoredQuestionReferences(snapshot: AppStateSnapshot): AppStateSnapshot {
  const seenIds = new Set<string>();
  const remappedQuestions: Array<{ oldId: string; newId: string; subjectId: string; contentKey: string }> = [];
  const subjects = snapshot.subjects.map(subject => ({
    ...subject,
    questions: subject.questions.map(question => {
      const currentId = questionIdKey(question.id);
      if (!question.id || seenIds.has(currentId)) {
        const newId = questionIdKey(genId());
        remappedQuestions.push({
          oldId: currentId,
          newId,
          subjectId: subject.id,
          contentKey: buildQuestionContentKey(question)
        });
        seenIds.add(newId);
        return { ...question, id: newId };
      }
      seenIds.add(currentId);
      return { ...question, id: currentId };
    })
  }));

  if (remappedQuestions.length === 0) return { ...snapshot, subjects, repairedQuestionIds: false };

  const validQuestionIds = new Set<string>();
  const questionIdBySubjectAndContent = new Map<string, string>();
  subjects.forEach(subject => {
    subject.questions.forEach(question => {
      const questionId = questionIdKey(question.id);
      validQuestionIds.add(questionId);
      questionIdBySubjectAndContent.set(`${subject.id}::${buildQuestionContentKey(question)}`, questionId);
    });
  });

  const remappedTargetsByOldId = new Map<string, Set<string>>();
  remappedQuestions.forEach(({ oldId, newId }) => {
    const key = questionIdKey(oldId);
    if (!remappedTargetsByOldId.has(key)) remappedTargetsByOldId.set(key, new Set());
    remappedTargetsByOldId.get(key)?.add(questionIdKey(newId));
  });

  const getRepairTargets = (oldId: string) => {
    const key = questionIdKey(oldId);
    const targets = new Set(remappedTargetsByOldId.get(key) || []);
    if (validQuestionIds.has(key)) targets.add(key);
    return targets;
  };

  const questionTags: QuestionTags = {};
  Object.entries(snapshot.questionTags || {}).forEach(([questionId, tags]) => {
    const targets = getRepairTargets(questionId);
    targets.forEach(targetId => mergeQuestionTags(questionTags, targetId, tags));
  });

  const favoriteIds = new Set<string>();
  snapshot.favoriteQuestionIds.forEach(questionId => {
    getRepairTargets(questionId).forEach(targetId => favoriteIds.add(targetId));
  });

  const latestWrongByQuestion = new Map<string, WrongQuestion>();
  snapshot.wrongQuestions.forEach(record => {
    const contentKey = buildQuestionContentKey(record);
    const exactId = questionIdBySubjectAndContent.get(`${record.subjectId}::${contentKey}`);
    const fallbackId = validQuestionIds.has(questionIdKey(record.id))
      ? questionIdKey(record.id)
      : [...getRepairTargets(record.id)][0];
    const nextId = exactId || fallbackId;
    if (!nextId) return;
    const normalized = { ...record, id: nextId };
    const prev = latestWrongByQuestion.get(nextId);
    const prevTime = prev ? new Date(prev.timestamp || 0).getTime() : -Infinity;
    const currTime = new Date(normalized.timestamp || 0).getTime();
    if (!prev || currTime >= prevTime) latestWrongByQuestion.set(nextId, normalized);
  });

  const examHistory = snapshot.examHistory.map(record => ({
    ...record,
    questions: Array.isArray(record.questions)
      ? record.questions
          .map(question => {
            const subjectId = question.subjectId || record.subjectId;
            const contentKey = buildQuestionContentKey({
              ...question,
              answer: question.correctAnswer
            } as Partial<Question>);
            const exactId = questionIdBySubjectAndContent.get(`${subjectId}::${contentKey}`);
            const fallbackId = validQuestionIds.has(questionIdKey(question.id))
              ? questionIdKey(question.id)
              : [...getRepairTargets(question.id)][0];
            const nextId = exactId || fallbackId;
            return nextId ? { ...question, id: nextId } : null;
          })
          .filter(Boolean) as any
      : record.questions
  }));

  return {
    ...snapshot,
    subjects,
    wrongQuestions: [...latestWrongByQuestion.values()],
    examHistory,
    questionTags,
    favoriteQuestionIds: [...favoriteIds],
    repairedQuestionIds: true
  };
}

export function normalizeSubjects(rawSubjects: any[]): Subject[] {
  return Array.isArray(rawSubjects)
    ? rawSubjects
        .map(subject => ({
          id: String(subject?.id || genId()),
          name: String(subject?.name || '未命名题库').trim() || '未命名题库',
          questions: Array.isArray(subject?.questions)
            ? subject.questions.map(normalizeImportedQuestion).filter(Boolean) as Question[]
            : []
        }))
        .filter(subject => subject.questions.length > 0 || subject.name)
    : [];
}
