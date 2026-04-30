import { describe, it, expect, beforeEach, vi } from 'vitest';

/* ===================================================================
   In-memory storage stubs so we control read/write without jsdom leaks
   =================================================================== */
let localStore: Record<string, string>;
let sessionStore: Record<string, string>;

function resetStores() {
  localStore = {};
  sessionStore = {};
}

/* ---- localStorage stub ---- */
const localStorageStub = {
  getItem: vi.fn((key: string) => (key in localStore ? localStore[key] : null)),
  setItem: vi.fn((key: string, value: string) => {
    localStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStore[key];
  }),
};

/* ---- sessionStorage stub ---- */
const sessionStorageStub = {
  getItem: vi.fn((key: string) => (key in sessionStore ? sessionStore[key] : null)),
  setItem: vi.fn((key: string, value: string) => {
    sessionStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete sessionStore[key];
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageStub,
  writable: true,
  configurable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: sessionStorageStub,
  writable: true,
  configurable: true,
});

beforeEach(() => {
  resetStores();
  vi.clearAllMocks();
  // Restore default implementations — vi.clearAllMocks does NOT reset
  // mockImplementation overrides, so a previous test that called
  // mockImplementation(() => { throw ... }) would permanently poison
  // the stub for all subsequent tests.
  localStorageStub.getItem.mockImplementation((key: string) => (key in localStore ? localStore[key] : null));
  localStorageStub.setItem.mockImplementation((key: string, value: string) => { localStore[key] = value; });
  localStorageStub.removeItem.mockImplementation((key: string) => { delete localStore[key]; });
  sessionStorageStub.getItem.mockImplementation((key: string) => (key in sessionStore ? sessionStore[key] : null));
  sessionStorageStub.setItem.mockImplementation((key: string, value: string) => { sessionStore[key] = value; });
  sessionStorageStub.removeItem.mockImplementation((key: string) => { delete sessionStore[key]; });
});

/* ===================================================================
   Dynamic import — runs after stubs are in place
   =================================================================== */
async function importStorage() {
  return await import('@/services/storage');
}

/* ===================================================================
   Tests
   =================================================================== */
describe('storage service', () => {
  /* ---- safeSetItem ---- */
  describe('safeSetItem', () => {
    it('writes to localStorage and returns true', async () => {
      const { safeSetItem } = await importStorage();
      const ok = safeSetItem('testKey', 'testValue');
      expect(ok).toBe(true);
      expect(localStorageStub.setItem).toHaveBeenCalledWith('testKey', 'testValue');
      expect(localStore['testKey']).toBe('testValue');
    });

    it('returns false when localStorage.setItem throws', async () => {
      localStorageStub.setItem.mockImplementationOnce(() => {
        throw new Error('quota exceeded');
      });
      // suppress console.warn in test output
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { safeSetItem } = await importStorage();
      const ok = safeSetItem('big', 'data');

      expect(ok).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('localStorage 写入失败: big'),
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });
  });

  /* ---- parseStorageJSON ---- */
  describe('parseStorageJSON', () => {
    it('parses valid JSON', async () => {
      localStore['users'] = JSON.stringify([{ id: 1 }, { id: 2 }]);
      const { parseStorageJSON } = await importStorage();
      const result = parseStorageJSON<{ id: number }[]>('users', []);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
    });

    it('returns fallback when key does not exist', async () => {
      const { parseStorageJSON } = await importStorage();
      const result = parseStorageJSON('missing', ['default']);
      expect(result).toEqual(['default']);
    });

    it('returns fallback when JSON is corrupt', async () => {
      localStore['corrupt'] = '{not valid json:::';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { parseStorageJSON } = await importStorage();

      const result = parseStorageJSON('corrupt', { safe: true });

      expect(result).toEqual({ safe: true });
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('localStorage 数据损坏: corrupt'),
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });

    it('returns fallback when stored value is null', async () => {
      // localStorage returns null for missing keys, but we simulate the
      // edge case where key exists with literal "null" string
      localStore['nullval'] = 'null';
      const { parseStorageJSON } = await importStorage();
      const result = parseStorageJSON('nullval', []);
      expect(result).toBeNull();
    });
  });

  /* ---- save helpers ---- */
  describe('save functions', () => {
    it('saveSubjects serializes and persists', async () => {
      const { saveSubjects } = await importStorage();
      const subjects = [{ id: 's1', name: 'Math', questions: [] }];
      saveSubjects(subjects);
      expect(localStore['subjects']).toBe(JSON.stringify(subjects));
    });

    it('saveFavorites serializes and persists', async () => {
      const { saveFavorites } = await importStorage();
      saveFavorites(['q1', 'q2']);
      expect(localStore['favoriteQuestionIds']).toBe(JSON.stringify(['q1', 'q2']));
    });

    it('saveQuestionTags serializes and persists', async () => {
      const { saveQuestionTags } = await importStorage();
      const tags = { q1: ['重点', '易错'] };
      saveQuestionTags(tags);
      expect(localStore['questionTags']).toBe(JSON.stringify(tags));
    });

    it('saveWrongQuestions serializes and persists', async () => {
      const { saveWrongQuestions } = await importStorage();
      const wrong = [{ id: 'q1', subjectId: 's1' }];
      saveWrongQuestions(wrong);
      expect(localStore['wrongQuestions']).toBe(JSON.stringify(wrong));
    });

    it('saveExamHistory serializes and persists', async () => {
      const { saveExamHistory } = await importStorage();
      const history = [{ id: 'r1', score: 80 }];
      saveExamHistory(history);
      expect(localStore['examHistory']).toBe(JSON.stringify(history));
    });

    it('saveBrowseAnswerMode persists show/hide', async () => {
      const { saveBrowseAnswerMode } = await importStorage();
      saveBrowseAnswerMode('hide');
      expect(localStore['browseAnswerMode']).toBe(JSON.stringify('hide'));
    });

    it('saveSidebarCollapsed and getSidebarCollapsed round-trip', async () => {
      const { saveSidebarCollapsed, getSidebarCollapsed } = await importStorage();

      saveSidebarCollapsed(true);
      expect(getSidebarCollapsed()).toBe(true);

      saveSidebarCollapsed(false);
      expect(getSidebarCollapsed()).toBe(false);
    });

    it('getSidebarCollapsed defaults to false when no stored value', async () => {
      const { getSidebarCollapsed } = await importStorage();
      expect(getSidebarCollapsed()).toBe(false);
    });

    it('save functions return false on error', async () => {
      localStorageStub.setItem.mockImplementationOnce(() => {
        throw new Error('quota');
      });
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { saveSubjects } = await importStorage();
      expect(saveSubjects([{ id: 'x' }])).toBe(false);
    });
  });

  /* ---- exam session (sessionStorage) ---- */
  describe('exam session lifecycle', () => {
    const validSession = {
      questions: [
        {
          id: 'q1', question: 'Q?', optionA: 'A', optionB: 'B',
          optionC: 'C', optionD: 'D', answer: 'A' as const,
        },
      ],
      currentIndex: 0,
      answers: {},
      startTime: new Date().toISOString(),
      effectiveStart: new Date().toISOString(),
      timeLimit: 30,
      timeLeft: 25 * 60,
      endTime: Date.now() + 25 * 60_000,
      subjectId: 's1',
      subjectName: 'Math',
      isWrongPractice: false,
    };

    it('saveExamSession writes to sessionStorage with savedAt', async () => {
      const { saveExamSession } = await importStorage();
      saveExamSession(validSession);

      const saved = JSON.parse(sessionStore['currentExam']);
      expect(saved.subjectId).toBe('s1');
      expect(saved.savedAt).toBeGreaterThan(0);
    });

    it('restoreExamSession returns parsed session', async () => {
      sessionStore['currentExam'] = JSON.stringify(validSession);
      const { restoreExamSession } = await importStorage();

      const result = restoreExamSession();
      expect(result).not.toBeNull();
      expect(result!.subjectId).toBe('s1');
      expect(result!.questions).toHaveLength(1);
    });

    it('restoreExamSession returns null when no session exists', async () => {
      const { restoreExamSession } = await importStorage();
      expect(restoreExamSession()).toBeNull();
    });

    it('restoreExamSession returns null and clears when questions is empty', async () => {
      sessionStore['currentExam'] = JSON.stringify({ ...validSession, questions: [] });
      const { restoreExamSession } = await importStorage();

      const result = restoreExamSession();
      expect(result).toBeNull();
      expect(sessionStore['currentExam']).toBeUndefined();
    });

    it('restoreExamSession returns null and clears when zero questions', async () => {
      sessionStore['currentExam'] = JSON.stringify({ ...validSession, questions: [] });
      const { restoreExamSession } = await importStorage();
      expect(restoreExamSession()).toBeNull();
      expect(sessionStore['currentExam']).toBeUndefined();
    });

    it('restoreExamSession returns null and clears on corrupt JSON', async () => {
      sessionStore['currentExam'] = '{{broken';
      const { restoreExamSession } = await importStorage();
      expect(restoreExamSession()).toBeNull();
      expect(sessionStore['currentExam']).toBeUndefined();
    });

    it('clearExamSession removes the key from sessionStorage', async () => {
      sessionStore['currentExam'] = JSON.stringify(validSession);
      const { clearExamSession } = await importStorage();
      clearExamSession();
      expect(sessionStore['currentExam']).toBeUndefined();
    });
  });

  /* ---- practice tracking ---- */
  describe('savePracticeTracking', () => {
    it('normalizes entries and saves both log and stats', async () => {
      const { savePracticeTracking } = await importStorage();
      const entries = [
        {
          id: 'p1',
          sessionId: 's1',
          date: '2026-04-29T10:00:00.000Z',
          subjectId: 'math',
          subjectName: '数学',
          totalQuestions: 10,
          correct: 7,
          mode: 'exam' as const,
          sourceExamRecordId: 'r1',
        },
      ];

      const ok = savePracticeTracking(entries);
      expect(ok).toBe(true);

      const savedLog = JSON.parse(localStore['practiceLog']);
      expect(savedLog).toHaveLength(1);
      expect(savedLog[0].totalQuestions).toBe(10);

      const savedStats = JSON.parse(localStore['practiceStats']);
      expect(savedStats.practiced).toBe(10);
      expect(savedStats.correct).toBe(7);
    });

    it('computes stats from log when no stats argument provided', async () => {
      const { savePracticeTracking } = await importStorage();
      const entries = [
        {
          id: 'p1', sessionId: 's1',
          date: '2026-04-29T10:00:00.000Z',
          subjectId: 'math', subjectName: '数学',
          totalQuestions: 5, correct: 3,
          mode: 'exam' as const, sourceExamRecordId: 'r1',
        },
        {
          id: 'p2', sessionId: 's2',
          date: '2026-04-29T11:00:00.000Z',
          subjectId: 'eng', subjectName: '英语',
          totalQuestions: 8, correct: 6,
          mode: 'exam' as const, sourceExamRecordId: 'r2',
        },
      ];

      savePracticeTracking(entries);

      const savedStats = JSON.parse(localStore['practiceStats']);
      expect(savedStats.practiced).toBe(13);
      expect(savedStats.correct).toBe(9);
    });

    it('uses provided stats when both arguments given', async () => {
      const { savePracticeTracking } = await importStorage();
      const entries = [
        {
          id: 'p1', sessionId: 's1',
          date: '2026-04-29T10:00:00.000Z',
          subjectId: 'math', subjectName: '数学',
          totalQuestions: 5, correct: 2,
          mode: 'exam' as const, sourceExamRecordId: 'r1',
        },
      ];
      const customStats = { total: 100, correct: 80, practiced: 200 };

      savePracticeTracking(entries, customStats);

      const savedStats = JSON.parse(localStore['practiceStats']);
      expect(savedStats).toEqual(customStats);
    });

    it('filters out invalid entries (zero totalQuestions)', async () => {
      const { savePracticeTracking } = await importStorage();
      const entries = [
        {
          id: 'bad', sessionId: 's1',
          date: '2026-04-29T10:00:00.000Z',
          subjectId: 'math', subjectName: '数学',
          totalQuestions: 0, correct: 0,
          mode: 'exam' as const, sourceExamRecordId: 'r1',
        },
        {
          id: 'good', sessionId: 's2',
          date: '2026-04-29T11:00:00.000Z',
          subjectId: 'eng', subjectName: '英语',
          totalQuestions: 5, correct: 5,
          mode: 'exam' as const, sourceExamRecordId: 'r2',
        },
      ];

      savePracticeTracking(entries);

      const savedLog = JSON.parse(localStore['practiceLog']);
      expect(savedLog).toHaveLength(1);
      expect(savedLog[0].id).toBe('good');
    });

    it('returns false when log save fails', async () => {
      // first call (practiceLog) fails, second (practiceStats) succeeds
      localStorageStub.setItem
        .mockImplementationOnce(() => { throw new Error('quota'); })
        .mockImplementationOnce(() => {});

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { savePracticeTracking } = await importStorage();
      const ok = savePracticeTracking([
        { id: 'p1', sessionId: 's1', date: new Date().toISOString(), subjectId: 'math', subjectName: '数学', totalQuestions: 5, correct: 3, mode: 'exam' as const, sourceExamRecordId: 'r1' },
      ]);
      expect(ok).toBe(false);
    });
  });

  /* ---- loadAppState ---- */
  describe('loadAppState', () => {
    it('returns a complete empty snapshot when no data exists', async () => {
      const { loadAppState } = await importStorage();
      const state = loadAppState();

      expect(state.subjects).toEqual([]);
      expect(state.wrongQuestions).toEqual([]);
      expect(state.examHistory).toEqual([]);
      expect(state.practiceLog).toEqual([]);
      expect(state.questionTags).toEqual({});
      expect(state.favoriteQuestionIds).toEqual([]);
      expect(state.browseAnswerMode).toBe('show');
      expect(state.migratedLegacyQuestions).toBe(0);
    });

    it('loads subjects from localStorage', async () => {
      localStore['subjects'] = JSON.stringify([
        {
          id: 's1',
          name: '数学',
          questions: [
            { id: 'q1', question: '1+1?', optionA: '1', optionB: '2', optionC: '3', optionD: '4', answer: 'B' },
          ],
        },
      ]);

      const { loadAppState } = await importStorage();
      const state = loadAppState();

      expect(state.subjects).toHaveLength(1);
      expect(state.subjects[0].name).toBe('数学');
      expect(state.subjects[0].questions).toHaveLength(1);
    });

    it('loads wrongQuestions from localStorage', async () => {
      localStore['subjects'] = JSON.stringify([]);
      localStore['wrongQuestions'] = JSON.stringify([
        {
          id: 'q1', question: 'Q?', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
          answer: 'A', subjectId: 's1', subjectName: '数学',
          userAnswer: 'B', timestamp: new Date().toISOString(),
        },
      ]);

      const { loadAppState } = await importStorage();
      const state = loadAppState();
      expect(state.wrongQuestions).toHaveLength(1);
    });

    it('loads exam history and rebuilds practice log from it when log is empty', async () => {
      localStore['subjects'] = JSON.stringify([]);
      localStore['examHistory'] = JSON.stringify([
        {
          id: 'r1',
          date: new Date().toISOString(),
          score: 80,
          correct: 8,
          totalQuestions: 10,
          duration: 300,
          timeLimit: 10,
          wrongCount: 2,
          subjectId: 's1',
          subjectName: '数学',
          questions: [],
        },
      ]);

      const { loadAppState } = await importStorage();
      const state = loadAppState();

      expect(state.examHistory).toHaveLength(1);
      // practiceLog is rebuilt from exam history when empty
      expect(state.practiceLog.length).toBeGreaterThanOrEqual(1);
    });

    it('handles corrupt data gracefully with fallbacks', async () => {
      localStore['subjects'] = 'not-json';
      localStore['wrongQuestions'] = '{oops';
      localStore['examHistory'] = '...';
      localStore['questionTags'] = 'bad';
      localStore['favoriteQuestionIds'] = 'xxx';

      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { loadAppState } = await importStorage();

      // should not throw — all fields fall back to sensible defaults
      const state = loadAppState();
      expect(state.subjects).toEqual([]);
      expect(state.wrongQuestions).toEqual([]);
      expect(state.examHistory).toEqual([]);
      expect(state.questionTags).toEqual({});
      expect(state.favoriteQuestionIds).toEqual([]);
    });

    it('loads favoriteQuestionIds and converts to strings', async () => {
      localStore['subjects'] = JSON.stringify([]);
      localStore['favoriteQuestionIds'] = JSON.stringify(['q1', 'q2', 123]);

      const { loadAppState } = await importStorage();
      const state = loadAppState();

      expect(state.favoriteQuestionIds).toEqual(['q1', 'q2', '123']);
    });

    it('loads browseAnswerMode with hide', async () => {
      localStore['subjects'] = JSON.stringify([]);
      localStore['browseAnswerMode'] = JSON.stringify('hide');

      const { loadAppState } = await importStorage();
      const state = loadAppState();
      expect(state.browseAnswerMode).toBe('hide');
    });

    it('defaults browseAnswerMode to show for unknown values', async () => {
      localStore['subjects'] = JSON.stringify([]);
      localStore['browseAnswerMode'] = JSON.stringify('random');

      const { loadAppState } = await importStorage();
      const state = loadAppState();
      expect(state.browseAnswerMode).toBe('show');
    });

    it('loads questionTags', async () => {
      localStore['subjects'] = JSON.stringify([]);
      localStore['questionTags'] = JSON.stringify({ q1: ['重点'], q2: ['易错', '常考'] });

      const { loadAppState } = await importStorage();
      const state = loadAppState();
      expect(state.questionTags).toEqual({ q1: ['重点'], q2: ['易错', '常考'] });
    });

    it('migrates legacy questions when subjects is empty and legacy exists', async () => {
      // no modern subjects, but legacy questions exist
      localStore['questions'] = JSON.stringify([
        { id: 'l1', question: 'Legacy Q?', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', answer: 'A' },
      ]);

      const { loadAppState } = await importStorage();
      const state = loadAppState();

      expect(state.migratedLegacyQuestions).toBe(1);
      expect(state.subjects).toHaveLength(1);
      expect(state.subjects[0].name).toBe('网络安全');
      expect(state.subjects[0].questions).toHaveLength(1);
    });

    it('skips empty legacy migration', async () => {
      // subjects key exists but is empty array; legacy also empty
      localStore['subjects'] = JSON.stringify([]);
      localStore['questions'] = JSON.stringify([]);

      const { loadAppState } = await importStorage();
      const state = loadAppState();

      expect(state.migratedLegacyQuestions).toBe(0);
      expect(state.subjects).toEqual([]);
    });

    it('persists loaded state back to storage (normalization)', async () => {
      // When we load state, persistLoadedState normalizes and rewrites
      // all keys. Verify that after loadAppState, the keys are written.
      localStore['subjects'] = JSON.stringify([
        {
          id: 's1', name: '物理',
          questions: [
            { id: 'q1', question: 'Q?', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', answer: 'A' },
          ],
        },
      ]);

      const { loadAppState } = await importStorage();
      loadAppState();

      // After loading, subjects should have been re-saved via persistLoadedState
      expect(localStorageStub.setItem).toHaveBeenCalledWith(
        'subjects',
        expect.any(String)
      );
      expect(localStorageStub.setItem).toHaveBeenCalledWith(
        'favoriteQuestionIds',
        expect.any(String)
      );
    });
  });
});
