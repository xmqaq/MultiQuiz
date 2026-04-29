import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import type { ExamRecord, Subject } from '@/types';

/* ---- mock storage ---- */
const storageMock = {
  saveExamSession: vi.fn(),
  restoreExamSession: vi.fn().mockReturnValue(null),
  clearExamSession: vi.fn(),
  saveWrongQuestions: vi.fn(),
  saveExamHistory: vi.fn(),
  savePracticeTracking: vi.fn(),
  saveSubjects: vi.fn(),
  saveFavorites: vi.fn(),
  saveQuestionTags: vi.fn(),
};
vi.mock('@/services/storage', () => storageMock);

/* ---- mock ui store ---- */
const uiMock = {
  showToast: vi.fn(),
  showModal: vi.fn(),
  switchTab: vi.fn(),
  closeModal: vi.fn(),
};
vi.mock('@/stores/ui', () => ({
  useUiStore: () => uiMock,
}));

/* ---- mock window APIs ---- */
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
    cb(0);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ---- helpers ---- */
function makeSubject(overrides: Partial<Subject> = {}): Subject {
  return {
    id: 's1',
    name: '测试学科',
    questions: [
      { id: 'q1', question: 'Q1?', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1', answer: 'A' as const },
      { id: 'q2', question: 'Q2?', optionA: 'A2', optionB: 'B2', optionC: 'C2', optionD: 'D2', answer: 'B' as const },
      { id: 'q3', question: 'Q3?', optionA: 'A3', optionB: 'B3', optionC: 'C3', optionD: 'D3', answer: 'C' as const },
      { id: 'q4', question: 'Q4?', optionA: 'A4', optionB: 'B4', optionC: 'C4', optionD: 'D4', answer: 'D' as const },
    ],
    ...overrides,
  };
}

interface SetupStoreOptions {
  subjects?: Subject[];
  wrongQuestions?: any[];
  favoriteIds?: string[];
  questionTags?: Record<string, string[]>;
}

async function setupStores(opts: SetupStoreOptions = {}) {
  // dynamic imports so mocks are in place first
  const { useExamStore } = await import('@/stores/exam');
  const { useLibraryStore } = await import('@/stores/library');

  const pinia = createPinia();
  setActivePinia(pinia);

  const library = useLibraryStore();
  const exam = useExamStore();

  // bypass init() which hits localStorage
  library.subjects = opts.subjects ?? [makeSubject()];
  library.wrongQuestions = opts.wrongQuestions ?? [];
  library.favoriteQuestionIds = opts.favoriteIds ?? [];
  library.questionTags = opts.questionTags ?? {};
  library.initialized = true;

  return { exam, library };
}

/* ================================================================ */
describe('exam store', () => {
  /* ------ startExam ------ */
  describe('startExam', () => {
    it('creates a session and starts the timer', async () => {
      const { exam } = await setupStores();
      exam.setup.subjectId = 's1';
      exam.setup.count = '2';
      exam.setup.time = 30;

      exam.startExam();

      expect(exam.currentExam).not.toBeNull();
      expect(exam.currentExam!.questions).toHaveLength(2);
      expect(exam.currentExam!.timeLimit).toBe(30);
      expect(exam.currentExam!.timeLeft).toBe(30 * 60);
      expect(storageMock.saveExamSession).toHaveBeenCalled();
    });

    it('uses all questions when count is "all"', async () => {
      const { exam } = await setupStores();
      exam.setup.subjectId = 's1';
      exam.setup.count = 'all';

      exam.startExam();

      expect(exam.currentExam!.questions).toHaveLength(4);
    });

    it('auto-adjusts when count exceeds pool', async () => {
      const { exam } = await setupStores();
      exam.setup.subjectId = 's1';
      exam.setup.count = '100';

      exam.startExam();

      expect(exam.currentExam!.questions).toHaveLength(4);
      expect(uiMock.showToast).toHaveBeenCalledWith(
        expect.stringContaining('已自动调整为全部题目'),
        'warning'
      );
    });

    it('shows toast and returns when pool is empty', async () => {
      const { exam } = await setupStores({
        subjects: [{ id: 'empty', name: '空', questions: [] }],
      });
      exam.setup.subjectId = 'empty';
      exam.setup.count = '20';

      exam.startExam();

      expect(exam.currentExam).toBeNull();
      expect(uiMock.showToast).toHaveBeenCalledWith(
        expect.stringContaining('暂无题目'),
        'warning'
      );
    });

    it('filters to favorites when favoritesOnly is set', async () => {
      const { exam } = await setupStores({
        favoriteIds: ['q1', 'q3'],
      });
      exam.setup.subjectId = 's1';
      exam.setup.count = 'all';
      exam.setup.favoritesOnly = true;

      exam.startExam();

      expect(exam.currentExam!.questions.length).toBeLessThanOrEqual(2);
      const ids = exam.currentExam!.questions.map((q: { id: string }) => q.id);
      expect(ids).toContain('q1');
      expect(ids).toContain('q3');
    });

    it('shows warning when favorites-only yields no questions', async () => {
      const { exam } = await setupStores({ favoriteIds: [] });
      exam.setup.subjectId = 's1';
      exam.setup.favoritesOnly = true;

      exam.startExam();

      expect(exam.currentExam).toBeNull();
      expect(uiMock.showToast).toHaveBeenCalledWith(
        expect.stringContaining('收藏'),
        'warning'
      );
    });
  });

  /* ------ startWrongPractice ------ */
  describe('startWrongPractice', () => {
    it('starts a practice session with wrong questions', async () => {
      const { exam, library } = await setupStores();
      library.wrongQuestions = [
        {
          id: 'q1', question: 'Q1?', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1',
          answer: 'A' as const, subjectId: 's1', subjectName: '测试学科',
          userAnswer: 'B' as const, timestamp: new Date().toISOString(),
        },
      ];

      exam.startWrongPractice('s1');

      expect(exam.currentExam).not.toBeNull();
      expect(exam.currentExam!.isWrongPractice).toBe(true);
      expect(exam.currentExam!.timeLimit).toBe(999);
      expect(exam.currentExam!.questions).toHaveLength(1);
      expect(uiMock.switchTab).toHaveBeenCalledWith('exam');
    });

    it('shows toast when no wrong questions exist', async () => {
      const { exam } = await setupStores();

      exam.startWrongPractice('s1');

      expect(exam.currentExam).toBeNull();
      expect(uiMock.showToast).toHaveBeenCalledWith(
        expect.stringContaining('暂无错题'),
        'info'
      );
    });
  });

  /* ------ retake ------ */
  describe('retake', () => {
    it('recreates a session from an exam record', async () => {
      const { exam } = await setupStores();
      const record: ExamRecord = {
        id: 'r1',
        date: new Date().toISOString(),
        score: 50,
        correct: 1,
        totalQuestions: 2,
        duration: 1,
        timeLimit: 30,
        wrongCount: 1,
        subjectId: 's1',
        subjectName: '测试学科',
        questions: [
          { id: 'q1', question: 'Q1?', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1', subjectId: 's1', subjectName: '测试学科', correctAnswer: 'A', userAnswer: 'B' },
          { id: 'q2', question: 'Q2?', optionA: 'A2', optionB: 'B2', optionC: 'C2', optionD: 'D2', subjectId: 's1', subjectName: '测试学科', correctAnswer: 'B', userAnswer: 'B' },
        ],
      };

      exam.retake(record);

      expect(exam.currentExam).not.toBeNull();
      expect(exam.currentExam!.questions).toHaveLength(2);
      expect(exam.currentExam!.timeLimit).toBe(30);
      expect(uiMock.switchTab).toHaveBeenCalledWith('exam');
    });
  });

  /* ------ chooseAnswer ------ */
  describe('chooseAnswer', () => {
    it('records the answer and saves session', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();
      const questionId = exam.currentExam!.questions[0].id;

      exam.chooseAnswer('B');

      expect(exam.currentExam!.answers[questionId]).toBe('B');
      expect(storageMock.saveExamSession).toHaveBeenCalled();
    });

    it('is a no-op when no active exam', async () => {
      const { exam } = await setupStores();
      exam.chooseAnswer('A');
      expect(exam.currentExam).toBeNull();
    });
  });

  /* ------ navigation ------ */
  describe('navigation', () => {
    it('jump moves to the correct index', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();

      exam.jump(2);

      expect(exam.currentExam!.currentIndex).toBe(2);
      expect(exam.activeQuestion).toBe(exam.currentExam!.questions[2]);
    });

    it('jump ignores out-of-bounds', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();

      exam.jump(99);
      expect(exam.currentExam!.currentIndex).toBe(0);

      exam.jump(-1);
      expect(exam.currentExam!.currentIndex).toBe(0);
    });

    it('prev and next wrap through jump', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();

      exam.next();
      expect(exam.currentExam!.currentIndex).toBe(1);
      exam.prev();
      expect(exam.currentExam!.currentIndex).toBe(0);
      exam.prev(); // boundary
      expect(exam.currentExam!.currentIndex).toBe(0);
    });
  });

  /* ------ submit ------ */
  describe('submit', () => {
    it('calculates score and records wrong questions', async () => {
      const { exam, library } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();

      const questions = exam.currentExam!.questions;
      // answer q0 correctly, q1 incorrectly, leave q2, q3 unanswered
      exam.jump(0);
      exam.chooseAnswer(questions[0].answer);
      exam.jump(1);
      exam.chooseAnswer(questions[1].answer === 'A' ? 'B' : 'A'); // wrong
      // q2 and q3 intentionally left unanswered to test "未作答" counting

      exam.submit();

      expect(exam.result).not.toBeNull();
      expect(exam.result!.correct).toBe(1);
      expect(exam.result!.total).toBe(4);
      expect(exam.result!.score).toBe(25); // 1/4 = 25%
      expect(exam.result!.wrongCount).toBe(3); // q1 wrong + q2,q3 unanswered
      expect(storageMock.clearExamSession).toHaveBeenCalled();
      // wrong questions should be added to library
      expect(library.wrongQuestions.length).toBeGreaterThanOrEqual(3);
      // answered-correct questions should be removed from wrong set
      expect(library.examHistory).toHaveLength(1);
    });

    it('handles wrong practice — removes corrected items', async () => {
      const { exam, library } = await setupStores();
      library.wrongQuestions = [
        {
          id: 'q1', question: 'Q1?', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1',
          answer: 'A' as const, subjectId: 's1', subjectName: '测试学科',
          userAnswer: 'B' as const, timestamp: new Date().toISOString(),
        },
      ];

      exam.startWrongPractice('s1');

      // answer correctly
      exam.chooseAnswer('A');

      exam.submit();

      expect(exam.result!.isWrongPractice).toBe(true);
      expect(exam.result!.correctedCount).toBe(1);
      // the corrected question should have been removed
      expect(library.wrongQuestions).toHaveLength(0);
    });

    it('stops the timer', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();

      const stopSpy = vi.spyOn(exam, 'stopTimer');
      exam.submit();

      expect(stopSpy).toHaveBeenCalled();
    });

    it('is a no-op when already completed', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();
      exam.currentExam!.completed = true;
      exam.submit();
      expect(exam.result).toBeNull();
    });
  });

  /* ------ timer ------ */
  describe('timer', () => {
    it('decrements timeLeft and submits when time expires', async () => {
      const { exam } = await setupStores();
      exam.setup.count = '2';
      exam.setup.time = 1; // 1 minute
      exam.startExam();

      const submitSpy = vi.spyOn(exam, 'submit');

      // Advance 61 seconds (past the 60-second limit)
      await vi.advanceTimersByTimeAsync(61_000);

      expect(submitSpy).toHaveBeenCalled();
    });

    it('saves session periodically', async () => {
      const { exam } = await setupStores();
      exam.setup.count = '2';
      exam.setup.time = 30;
      exam.startExam();

      storageMock.saveExamSession.mockClear();

      // Advance 10 seconds to trigger the save
      await vi.advanceTimersByTimeAsync(10_001);

      expect(storageMock.saveExamSession).toHaveBeenCalled();
    });

    it('stopTimer clears the interval', async () => {
      const { exam } = await setupStores();
      exam.setup.count = '2';
      exam.setup.time = 30;
      exam.startExam();

      const submitSpy = vi.spyOn(exam, 'submit');
      exam.stopTimer();

      await vi.advanceTimersByTimeAsync(60_000);
      expect(submitSpy).not.toHaveBeenCalled();
    });

    it('does not start timer for wrong practice', async () => {
      const { exam, library } = await setupStores();
      library.wrongQuestions = [
        {
          id: 'q1', question: 'Q1?', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1',
          answer: 'A' as const, subjectId: 's1', subjectName: '测试学科',
          userAnswer: 'B' as const, timestamp: new Date().toISOString(),
        },
      ];

      exam.startWrongPractice('s1');

      const submitSpy = vi.spyOn(exam, 'submit');
      await vi.advanceTimersByTimeAsync(10_000);
      expect(submitSpy).not.toHaveBeenCalled();
    });
  });

  /* ------ restart ------ */
  describe('restart', () => {
    it('clears all state', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();

      exam.restart();

      expect(exam.currentExam).toBeNull();
      expect(exam.result).toBeNull();
      expect(storageMock.clearExamSession).toHaveBeenCalled();
    });
  });

  /* ------ restoreSavedSession ------ */
  describe('restoreSavedSession', () => {
    it('prompts restore for a valid saved session', async () => {
      const { exam } = await setupStores();
      storageMock.restoreExamSession.mockReturnValueOnce({
        questions: [
          { id: 'q1', question: 'Q1?', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1', answer: 'A' },
        ],
        currentIndex: 0,
        answers: {},
        startTime: new Date().toISOString(),
        effectiveStart: new Date().toISOString(),
        timeLimit: 30,
        timeLeft: 10,
        endTime: Date.now() + 10_000,
        subjectId: 's1',
        subjectName: '测试',
        isWrongPractice: false,
      });

      exam.restoreSavedSession();

      expect(uiMock.showModal).toHaveBeenCalledWith(
        expect.stringContaining('未完成考试'),
        expect.any(String),
        expect.any(Array)
      );
    });

    it('clears expired session', async () => {
      const { exam } = await setupStores();
      storageMock.restoreExamSession.mockReturnValueOnce({
        questions: [
          { id: 'q1', question: 'Q1?', optionA: 'A1', optionB: 'B1', optionC: 'C1', optionD: 'D1', answer: 'A' },
        ],
        currentIndex: 0,
        answers: {},
        startTime: new Date().toISOString(),
        effectiveStart: new Date().toISOString(),
        timeLimit: 30,
        timeLeft: 0,
        endTime: Date.now() - 1000,
        subjectId: 's1',
        subjectName: '测试',
        isWrongPractice: false,
      });

      exam.restoreSavedSession();

      expect(storageMock.clearExamSession).toHaveBeenCalled();
      expect(uiMock.showToast).toHaveBeenCalledWith(
        expect.stringContaining('时间已用完'),
        'info'
      );
    });

    it('does nothing when no saved session', async () => {
      const { exam } = await setupStores();
      storageMock.restoreExamSession.mockReturnValueOnce(null);

      exam.restoreSavedSession();

      expect(uiMock.showModal).not.toHaveBeenCalled();
    });
  });

  /* ------ getters ------ */
  describe('getters', () => {
    it('activeQuestion returns current question', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();

      expect(exam.activeQuestion).toBe(exam.currentExam!.questions[0]);

      exam.next();
      expect(exam.activeQuestion).toBe(exam.currentExam!.questions[1]);
    });

    it('activeQuestion returns null without exam', async () => {
      const { exam } = await setupStores();
      expect(exam.activeQuestion).toBeNull();
    });

    it('progressPercent calculates correctly', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam(); // 4 questions

      expect(exam.progressPercent).toBe(25); // (0+1)/4 = 25%

      exam.next();
      expect(exam.progressPercent).toBe(50);
    });

    it('progressPercent returns 0 for empty exam', async () => {
      const { exam } = await setupStores();
      expect(exam.progressPercent).toBe(0);
    });

    it('answeredCount tracks answered questions', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();

      expect(exam.answeredCount).toBe(0);

      exam.chooseAnswer('A');
      expect(exam.answeredCount).toBe(1);
    });

    it('timeDisplay formats seconds correctly', async () => {
      const { exam } = await setupStores();
      exam.setup.count = 'all';
      exam.startExam();
      exam.currentExam!.timeLeft = 125; // 2:05

      expect(exam.timeDisplay).toBe('02:05');
    });

    it('timeDisplay handles zero', async () => {
      const { exam } = await setupStores();
      expect(exam.timeDisplay).toBe('00:00');
    });
  });

  /* ------ buildPool ------ */
  describe('buildPool', () => {
    it('returns all questions for "all" subject', async () => {
      const { exam, library } = await setupStores();
      // add a second subject
      library.subjects.push(makeSubject({ id: 's2', name: '学科2' }));

      const pool = exam.buildPool('all');
      expect(pool).toHaveLength(8);
    });

    it('returns subject-specific questions', async () => {
      const { exam } = await setupStores();
      const pool = exam.buildPool('s1');
      expect(pool).toHaveLength(4);
    });

    it('returns empty for unknown subject', async () => {
      const { exam } = await setupStores();
      const pool = exam.buildPool('nonexistent');
      expect(pool).toHaveLength(0);
    });
  });
});
