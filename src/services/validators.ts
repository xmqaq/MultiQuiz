import type { AnswerOption, Question } from '@/types';
import { genId } from './utils';

const ANSWERS = new Set(['A', 'B', 'C', 'D']);

export function normalizeAnswer(value: unknown): AnswerOption | null {
  const answer = String(value ?? '').trim().toUpperCase();
  return ANSWERS.has(answer) ? (answer as AnswerOption) : null;
}

export function normalizeImportedQuestion(raw: any): Question | null {
  const answer = normalizeAnswer(raw?.answer ?? raw?.correctAnswer);
  const question = String(raw?.question ?? '').trim();
  const optionA = String(raw?.optionA ?? raw?.A ?? '').trim();
  const optionB = String(raw?.optionB ?? raw?.B ?? '').trim();
  const optionC = String(raw?.optionC ?? raw?.C ?? '').trim();
  const optionD = String(raw?.optionD ?? raw?.D ?? '').trim();

  if (!question || !optionA || !optionB || !optionC || !optionD || !answer) return null;

  return {
    id: String(raw?.id || genId()),
    question,
    optionA,
    optionB,
    optionC,
    optionD,
    answer
  };
}

export function validateImportQuestions(rawQuestions: any[]): Question[] {
  return rawQuestions.map(normalizeImportedQuestion).filter(Boolean) as Question[];
}
