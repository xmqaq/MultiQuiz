import { describe, expect, it, vi } from 'vitest';
import type { AppStateSnapshot, WrongQuestion } from '@/types';
import { smartSelectQuestions } from '@/services/examLogic';
import { parseExcelRows } from '@/services/importer';
import { ensurePracticeLogConsistency, repairStoredQuestionReferences } from '@/services/migrations';
import { loadAppState } from '@/services/storage';
import { normalizeImportedQuestion } from '@/services/validators';

describe('validators', () => {
  it('normalizes valid imported questions', () => {
    const question = normalizeImportedQuestion({
      question: '题干',
      optionA: 'A1',
      optionB: 'B1',
      optionC: 'C1',
      optionD: 'D1',
      answer: 'a'
    });
    expect(question?.answer).toBe('A');
    expect(question?.id).toBeTruthy();
  });

  it('drops invalid imported questions', () => {
    expect(normalizeImportedQuestion({ question: '缺答案' })).toBeNull();
  });
});

describe('import parser', () => {
  it('parses Excel-like rows', () => {
    const rows = [
      ['题目', 'A', 'B', 'C', 'D', '答案'],
      ['中国近代史的开端是？', '鸦片战争', '甲午战争', '辛亥革命', '五四运动', 'A']
    ];
    const parsed = parseExcelRows(rows);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].optionA).toBe('鸦片战争');
  });
});

describe('storage migrations', () => {
  it('migrates legacy questions to subjects', () => {
    localStorage.clear();
    localStorage.setItem('questions', JSON.stringify([
      { question: 'Q', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', answer: 'B' }
    ]));
    const state = loadAppState();
    expect(state.migratedLegacyQuestions).toBe(1);
    expect(state.subjects[0].name).toBe('网络安全');
  });

  it('repairs duplicated question ids and related references', () => {
    const snapshot: AppStateSnapshot = {
      subjects: [{
        id: 's1',
        name: '测试',
        questions: [
          { id: 'same', question: 'Q1', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', answer: 'A' },
          { id: 'same', question: 'Q2', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', answer: 'B' }
        ]
      }],
      wrongQuestions: [],
      practiceStats: { total: 0, correct: 0, practiced: 0 },
      examHistory: [],
      practiceLog: [],
      questionTags: { same: ['重点'] },
      favoriteQuestionIds: ['same'],
      browseAnswerMode: 'show',
      migratedLegacyQuestions: 0,
      repairedQuestionIds: false
    };
    const repaired = repairStoredQuestionReferences(snapshot);
    expect(repaired.repairedQuestionIds).toBe(true);
    expect(new Set(repaired.subjects[0].questions.map(q => q.id)).size).toBe(2);
  });

  it('rebuilds practice log from exam history', () => {
    const result = ensurePracticeLogConsistency([], [{
      id: 'r1',
      date: new Date().toISOString(),
      score: 50,
      correct: 1,
      totalQuestions: 2,
      duration: 1,
      timeLimit: 30,
      wrongCount: 1,
      subjectId: 's1',
      subjectName: '测试',
      questions: [
        { id: 'q1', question: 'Q1', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', subjectId: 's1', subjectName: '测试', correctAnswer: 'A', userAnswer: 'A' },
        { id: 'q2', question: 'Q2', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', subjectId: 's1', subjectName: '测试', correctAnswer: 'B', userAnswer: 'A' }
      ]
    }]);
    expect(result.practiceLog).toHaveLength(1);
    expect(result.practiceStats.practiced).toBe(2);
    expect(result.practiceStats.correct).toBe(1);
  });
});

describe('smartSelectQuestions', () => {
  it('weights wrong and tagged questions without duplicating selection', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0);
    const pool = [
      { id: 'q1', question: 'Q1', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', answer: 'A' as const },
      { id: 'q2', question: 'Q2', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', answer: 'B' as const }
    ];
    const wrongQuestions: WrongQuestion[] = [{
      ...pool[1],
      subjectId: 's1',
      subjectName: '测试',
      userAnswer: 'A',
      timestamp: new Date().toISOString()
    }];
    const selected = smartSelectQuestions(pool, 2, { wrongFirst: true, weighted: true, tagged: true }, wrongQuestions, { q2: ['需复习'] });
    expect(selected.map(q => q.id).sort()).toEqual(['q1', 'q2']);
    spy.mockRestore();
  });
});
