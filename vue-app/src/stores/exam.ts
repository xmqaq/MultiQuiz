import { defineStore } from 'pinia';
import type { AnswerOption, ExamRecord, ExamSession, PracticeLogEntry, Question, WrongQuestion } from '@/types';
import { clearExamSession, restoreExamSession, saveExamSession } from '@/services/storage';
import { smartSelectQuestions } from '@/services/examLogic';
import { genId, questionIdKey, shuffleArray } from '@/services/utils';
import { useLibraryStore } from './library';
import { useUiStore } from './ui';

interface ExamResult {
  score: number;
  correct: number;
  total: number;
  duration: number;
  wrongCount: number;
  correctedCount: number;
  isWrongPractice: boolean;
}

export const useExamStore = defineStore('exam', {
  state: () => ({
    currentExam: null as ExamSession | null,
    result: null as ExamResult | null,
    timerId: 0 as number,
    setup: {
      subjectId: 'all',
      count: '20',
      time: 60,
      wrongFirst: false,
      weighted: false,
      tagged: false,
      favoritesOnly: false
    }
  }),
  getters: {
    activeQuestion: state => state.currentExam?.questions[state.currentExam.currentIndex] || null,
    answeredCount: state => Object.keys(state.currentExam?.answers || {}).length,
    progressPercent(): number {
      if (!this.currentExam?.questions.length) return 0;
      return Math.round(((this.currentExam.currentIndex + 1) / this.currentExam.questions.length) * 100);
    },
    timeDisplay(): string {
      const seconds = this.currentExam?.timeLeft || 0;
      const minutes = Math.floor(seconds / 60);
      const rest = seconds % 60;
      return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
    }
  },
  actions: {
    scrollExamTop() {
      if (typeof window === 'undefined') return;
      window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
    },
    subjectQuestionCount(subjectId?: string) {
      const selectedSubjectId = subjectId || this.setup.subjectId;
      const library = useLibraryStore();
      if (selectedSubjectId === 'all') return library.totalQuestions;
      return library.subjects.find(subject => subject.id === selectedSubjectId)?.questions.length || 0;
    },
    buildPool(subjectId: string) {
      const library = useLibraryStore();
      if (subjectId === 'all') return library.allQuestions;
      const subject = library.subjects.find(item => item.id === subjectId);
      return subject
        ? subject.questions.map(question => ({ ...question, _subjectId: subject.id, _subjectName: subject.name }))
        : [];
    },
    startExam() {
      const library = useLibraryStore();
      const ui = useUiStore();
      let pool = this.buildPool(this.setup.subjectId);
      let subjectName = this.setup.subjectId === 'all'
        ? '全部学科'
        : library.subjects.find(subject => subject.id === this.setup.subjectId)?.name || '当前学科';

      if (this.setup.favoritesOnly) {
        pool = pool.filter(question => library.isFavorited(question.id));
        subjectName += ' · 收藏题';
      }
      if (pool.length === 0) {
        ui.showToast(this.setup.favoritesOnly ? '当前范围内没有收藏题目' : '该范围暂无题目，请先导入', 'warning');
        return;
      }

      const targetCount = this.setup.count === 'all' ? pool.length : Number(this.setup.count);
      let questions = this.setup.wrongFirst || this.setup.weighted || this.setup.tagged
        ? smartSelectQuestions(pool, targetCount, {
            wrongFirst: this.setup.wrongFirst,
            weighted: this.setup.weighted,
            tagged: this.setup.tagged
          }, library.wrongQuestions, library.questionTags)
        : shuffleArray(pool).slice(0, Math.min(targetCount, pool.length));

      if (targetCount > pool.length) {
        questions = shuffleArray(pool);
        ui.showToast(`题库只有 ${pool.length} 道题，已自动调整为全部题目`, 'warning');
      }

      this.result = null;
      this.currentExam = {
        questions,
        currentIndex: 0,
        answers: {},
        startTime: new Date().toISOString(),
        effectiveStart: new Date().toISOString(),
        timeLimit: Number(this.setup.time),
        timeLeft: Number(this.setup.time) * 60,
        endTime: Date.now() + Number(this.setup.time) * 60 * 1000,
        subjectId: this.setup.subjectId,
        subjectName,
        isWrongPractice: false,
        completed: false
      };
      saveExamSession(this.currentExam);
      this.startTimer();
      this.scrollExamTop();
    },
    startWrongPractice(subjectId = 'all') {
      const library = useLibraryStore();
      const ui = useUiStore();
      const pool = subjectId === 'all'
        ? library.wrongQuestions
        : library.wrongQuestions.filter(question => question.subjectId === subjectId);
      if (pool.length === 0) {
        ui.showToast('当前范围暂无错题可练习', 'info');
        return;
      }
      const subjectName = subjectId === 'all'
        ? '错题练习'
        : `${library.subjects.find(subject => subject.id === subjectId)?.name || '当前学科'}错题练习`;
      this.result = null;
      this.currentExam = {
        questions: shuffleArray(pool),
        currentIndex: 0,
        answers: {},
        startTime: new Date().toISOString(),
        effectiveStart: new Date().toISOString(),
        timeLimit: 999,
        timeLeft: 999 * 60,
        endTime: null,
        subjectId: subjectId === 'all' ? 'wrong-all' : subjectId,
        subjectName,
        isWrongPractice: true,
        completed: false
      };
      saveExamSession(this.currentExam);
      useUiStore().switchTab('exam');
      this.scrollExamTop();
    },
    retake(record: ExamRecord) {
      const questions = record.questions.map(question => ({
        id: question.id,
        question: question.question,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        answer: question.correctAnswer,
        _subjectId: question.subjectId || record.subjectId,
        _subjectName: question.subjectName || record.subjectName
      }));
      const timeLimit = record.timeLimit || Math.max(30, Math.ceil(questions.length / 30) * 30);
      this.currentExam = {
        questions,
        currentIndex: 0,
        answers: {},
        startTime: new Date().toISOString(),
        effectiveStart: new Date().toISOString(),
        timeLimit,
        timeLeft: timeLimit * 60,
        endTime: Date.now() + timeLimit * 60 * 1000,
        subjectId: record.subjectId,
        subjectName: record.subjectName,
        isWrongPractice: false,
        completed: false
      };
      this.result = null;
      saveExamSession(this.currentExam);
      useUiStore().switchTab('exam');
      this.startTimer();
      this.scrollExamTop();
    },
    restoreSavedSession() {
      const ui = useUiStore();
      const session = restoreExamSession();
      if (!session) return;
      if (!session.isWrongPractice) {
        const now = Date.now();
        let remaining = session.timeLeft || 0;
        if (typeof session.endTime === 'number') {
          remaining = Math.max(0, Math.floor((session.endTime - now) / 1000));
        } else if (typeof session.savedAt === 'number') {
          remaining = Math.max(0, remaining - Math.floor((now - session.savedAt) / 1000));
          session.endTime = now + remaining * 1000;
        }
        session.timeLeft = remaining;
        if (remaining <= 0) {
          clearExamSession();
          ui.showToast('上次考试时间已用完，已自动清除', 'info');
          return;
        }
      }
      ui.showModal('检测到未完成考试', '是否继续上次未完成的考试？', [
        { label: '继续答题', action: () => {
          this.currentExam = { ...session, completed: false };
          this.result = null;
          ui.switchTab('exam');
          if (!session.isWrongPractice) this.startTimer();
        }},
        { label: '放弃考试', style: 'danger', action: () => clearExamSession() }
      ]);
    },
    startTimer() {
      this.stopTimer();
      if (!this.currentExam || this.currentExam.isWrongPractice) return;
      if (!this.currentExam.endTime) {
        this.currentExam.endTime = Date.now() + (this.currentExam.timeLeft || this.currentExam.timeLimit * 60) * 1000;
      }
      this.timerId = window.setInterval(() => {
        if (!this.currentExam) return;
        const remaining = Math.max(0, Math.floor(((this.currentExam.endTime || 0) - Date.now()) / 1000));
        this.currentExam.timeLeft = remaining;
        if (remaining % 10 === 0) saveExamSession(this.currentExam);
        if (remaining <= 0) this.submit();
      }, 1000);
    },
    stopTimer() {
      if (this.timerId) window.clearInterval(this.timerId);
      this.timerId = 0;
    },
    chooseAnswer(answer: AnswerOption) {
      if (!this.currentExam || this.currentExam.completed) return;
      const question = this.activeQuestion;
      if (!question) return;
      this.currentExam.answers[question.id] = answer;
      saveExamSession(this.currentExam);
    },
    jump(index: number) {
      if (!this.currentExam || this.currentExam.completed) return;
      if (index >= 0 && index < this.currentExam.questions.length) {
        this.currentExam.currentIndex = index;
        saveExamSession(this.currentExam);
        this.scrollExamTop();
      }
    },
    prev() {
      if (!this.currentExam) return;
      this.jump(this.currentExam.currentIndex - 1);
    },
    next() {
      if (!this.currentExam) return;
      this.jump(this.currentExam.currentIndex + 1);
    },
    submit() {
      if (!this.currentExam || this.currentExam.completed) return;
      const library = useLibraryStore();
      this.stopTimer();
      clearExamSession();
      this.currentExam.completed = true;

      const newWrong: WrongQuestion[] = [];
      const corrected: string[] = [];
      let correct = 0;

      this.currentExam.questions.forEach(question => {
        const userAnswer = this.currentExam?.answers[question.id];
        if (userAnswer === question.answer) {
          correct += 1;
          if (this.currentExam?.isWrongPractice) corrected.push(question.id);
        } else if (!this.currentExam?.isWrongPractice) {
          newWrong.push({
            ...question,
            subjectId: question._subjectId || this.currentExam?.subjectId || '',
            subjectName: question._subjectName || this.currentExam?.subjectName || '',
            userAnswer: userAnswer || '未作答',
            timestamp: new Date().toISOString()
          });
        }
      });

      if (this.currentExam.isWrongPractice) {
        library.removeWrongByIds(corrected);
      } else {
        const answeredCorrectIds = this.currentExam.questions
          .filter(question => this.currentExam?.answers[question.id] === question.answer)
          .map(question => question.id);
        library.removeWrongByIds(answeredCorrectIds);
        library.addWrongQuestions(newWrong);
      }

      const total = this.currentExam.questions.length;
      const score = Math.round((correct / total) * 100);
      const submittedAt = new Date().toISOString();
      const sessionId = genId();
      const duration = Math.max(0, Math.round((Date.now() - new Date(this.currentExam.effectiveStart || this.currentExam.startTime).getTime()) / 60000));
      const entries = this.buildPracticeEntries(sessionId, submittedAt);

      if (!this.currentExam.isWrongPractice) {
        library.addExamRecord({
          id: sessionId,
          date: submittedAt,
          score,
          correct,
          totalQuestions: total,
          duration,
          timeLimit: this.currentExam.timeLimit,
          wrongCount: newWrong.length,
          subjectId: this.currentExam.subjectId,
          subjectName: this.currentExam.subjectName,
          questions: this.currentExam.questions.map(question => ({
            id: question.id,
            question: question.question,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            subjectId: question._subjectId || question.subjectId || this.currentExam?.subjectId || '',
            subjectName: question._subjectName || question.subjectName || this.currentExam?.subjectName || '',
            correctAnswer: question.answer,
            userAnswer: this.currentExam?.answers[question.id] || '未作答'
          }))
        });
      }
      library.addPracticeEntries(entries);
      this.result = {
        score,
        correct,
        total,
        duration,
        wrongCount: newWrong.length,
        correctedCount: corrected.length,
        isWrongPractice: this.currentExam.isWrongPractice
      };
      this.scrollExamTop();
    },
    buildPracticeEntries(sessionId: string, date: string): PracticeLogEntry[] {
      if (!this.currentExam) return [];
      const currentExam = this.currentExam;
      const subjectSummary = new Map<string, PracticeLogEntry>();
      currentExam.questions.forEach(question => {
        const subjectId = String(question._subjectId || question.subjectId || currentExam.subjectId || '');
        const subjectName = String(question._subjectName || question.subjectName || currentExam.subjectName || '');
        const key = `${subjectId}::${subjectName}`;
        if (!subjectSummary.has(key)) {
          subjectSummary.set(key, {
            id: genId(),
            sessionId,
            date,
            subjectId,
            subjectName,
            totalQuestions: 0,
            correct: 0,
            mode: currentExam.isWrongPractice ? 'wrong' : 'exam',
            sourceExamRecordId: currentExam.isWrongPractice ? '' : sessionId
          });
        }
        const summary = subjectSummary.get(key);
        if (!summary) return;
        summary.totalQuestions += 1;
        if (currentExam.answers[question.id] === question.answer) summary.correct += 1;
      });
      return [...subjectSummary.values()];
    },
    restart() {
      this.stopTimer();
      this.currentExam = null;
      this.result = null;
      clearExamSession();
      this.scrollExamTop();
    }
  }
});
