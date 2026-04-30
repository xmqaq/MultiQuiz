export type AnswerOption = 'A' | 'B' | 'C' | 'D';

export interface Question {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  answer: AnswerOption;
  _subjectId?: string;
  _subjectName?: string;
  subjectId?: string;
  subjectName?: string;
  weight?: number;
}

export interface Subject {
  id: string;
  name: string;
  questions: Question[];
}

export interface WrongQuestion extends Question {
  subjectId: string;
  subjectName: string;
  userAnswer: AnswerOption | '未作答';
  timestamp: string;
}

export interface ExamRecordQuestion {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  subjectId: string;
  subjectName: string;
  correctAnswer: AnswerOption;
  userAnswer: AnswerOption | '未作答';
}

export interface ExamRecord {
  id: string;
  date: string;
  score: number;
  correct: number;
  totalQuestions: number;
  duration: number;
  timeLimit: number;
  wrongCount: number;
  subjectId: string;
  subjectName: string;
  questions: ExamRecordQuestion[];
}

export type PracticeMode = 'exam' | 'wrong' | 'legacy';

export interface PracticeLogEntry {
  id: string;
  sessionId: string;
  date: string;
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  correct: number;
  mode: PracticeMode;
  sourceExamRecordId: string;
}

export interface PracticeStats {
  total: number;
  correct: number;
  practiced: number;
}

export type QuestionTags = Record<string, string[]>;
export type FavoriteQuestionId = string;

export interface ExamSession {
  questions: Question[];
  currentIndex: number;
  answers: Record<string, AnswerOption>;
  startTime: string;
  effectiveStart: string;
  timeLimit: number;
  timeLeft?: number;
  endTime?: number | null;
  savedAt?: number;
  subjectId: string;
  subjectName: string;
  isWrongPractice: boolean;
  completed?: boolean;
}

export interface BackupV2 {
  version: '2.0';
  timestamp: string;
  exportDate?: string;
  subjects: Subject[];
  wrongQuestions: WrongQuestion[];
  practiceStats: PracticeStats;
  examHistory: ExamRecord[];
  practiceLog: PracticeLogEntry[];
  questionTags: QuestionTags;
  favoriteQuestionIds: FavoriteQuestionId[];
}

export interface AppStateSnapshot {
  subjects: Subject[];
  wrongQuestions: WrongQuestion[];
  practiceStats: PracticeStats;
  examHistory: ExamRecord[];
  practiceLog: PracticeLogEntry[];
  questionTags: QuestionTags;
  favoriteQuestionIds: FavoriteQuestionId[];
  browseAnswerMode: 'show' | 'hide';
  migratedLegacyQuestions: number;
  repairedQuestionIds: boolean;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

export interface ModalAction {
  label: string;
  style?: 'primary' | 'secondary' | 'danger' | 'ghost';
  description?: string;
  action: () => void;
}
