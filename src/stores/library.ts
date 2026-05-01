import { defineStore } from 'pinia';
import type {
  AppStateSnapshot,
  BackupV2,
  ExamRecord,
  FavoriteQuestionId,
  PracticeLogEntry,
  PracticeStats,
  Subject,
  WrongQuestion
} from '@/types';
import { DEFAULT_TAGS } from '@/services/constants';
import { exportBackup, restoreBackup } from '@/services/backup';
import { parseQuestionFile } from '@/services/importer';
import { ensurePracticeLogConsistency, getPracticeLogSummary, trimPracticeLog } from '@/services/migrations';
import {
  loadAppState,
  saveExamHistory,
  saveFavorites,
  savePracticeTracking,
  saveQuestionTags,
  saveSubjects,
  saveWrongQuestions
} from '@/services/storage';
import { downloadBlob, downloadJson, downloadText, genId, questionIdKey, today } from '@/services/utils';
import { useUiStore } from './ui';

/** Debounce helper: batches rapid calls so we only persist once per burst of mutations. */
function debouncedPersist(store: ReturnType<typeof useLibraryStore>) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return () => {
    if (timer !== null) return; // already scheduled
    timer = setTimeout(() => {
      timer = null;
      store.persistAll();
    }, 80);
  };
}

export const useLibraryStore = defineStore('library', {
  state: () => ({
    initialized: false,
    subjects: [] as Subject[],
    wrongQuestions: [] as WrongQuestion[],
    practiceStats: { total: 0, correct: 0, practiced: 0 } as PracticeStats,
    examHistory: [] as ExamRecord[],
    practiceLog: [] as PracticeLogEntry[],
    questionTags: {} as Record<string, string[]>,
    favoriteQuestionIds: [] as FavoriteQuestionId[],
    availableTags: [...DEFAULT_TAGS],
    browseAnswerMode: 'show' as 'show' | 'hide'
  }),
  getters: {
    totalQuestions: state => state.subjects.reduce((sum, subject) => sum + subject.questions.length, 0),
    favoriteSet: state => new Set(state.favoriteQuestionIds.map(id => String(id))),
    allQuestions: state => state.subjects.flatMap(subject =>
      subject.questions.map(question => ({
        ...question,
        _subjectId: subject.id,
        _subjectName: subject.name
      }))
    ),
    subjectOptions: state => state.subjects.map(subject => ({ id: subject.id, name: subject.name }))
  },
  actions: {
    init() {
      const snapshot = loadAppState();
      this.applySnapshot(snapshot);
      this.initialized = true;
      const ui = useUiStore();
      if (snapshot.migratedLegacyQuestions > 0) {
        ui.showToast(`已迁移旧题库 ${snapshot.migratedLegacyQuestions} 道题`, 'info');
      }
      if (snapshot.repairedQuestionIds) {
        ui.showToast('已修复历史题目 ID 引用', 'info');
      }

      // Auto-persist on any state change (debounced).
      this.$subscribe(debouncedPersist(this), { detached: true });
    },
    applySnapshot(snapshot: AppStateSnapshot | BackupV2) {
      this.subjects = snapshot.subjects || [];
      this.wrongQuestions = snapshot.wrongQuestions || [];
      this.practiceStats = snapshot.practiceStats || { total: 0, correct: 0, practiced: 0 };
      this.examHistory = snapshot.examHistory || [];
      this.practiceLog = snapshot.practiceLog || [];
      this.questionTags = snapshot.questionTags || {};
      this.favoriteQuestionIds = (snapshot.favoriteQuestionIds || []).map(id => String(id));
      this.browseAnswerMode = 'browseAnswerMode' in snapshot && snapshot.browseAnswerMode === 'hide' ? 'hide' : 'show';
      this.persistAll();
      this.cleanupOrphanFavorites();
    },
    persistAll() {
      const ok = [
        saveSubjects(this.subjects),
        saveWrongQuestions(this.wrongQuestions),
        saveExamHistory(this.examHistory),
        saveQuestionTags(this.questionTags),
        saveFavorites(this.favoriteQuestionIds),
        savePracticeTracking(this.practiceLog, this.practiceStats)
      ].every(Boolean);
      if (!ok) {
        console.warn('Partial localStorage write failure in persistAll');
      }
      return ok;
    },
    cleanupOrphanFavorites() {
      const allIds = new Set(this.allQuestions.map(question => questionIdKey(question.id)));
      const next = this.favoriteQuestionIds.filter(id => allIds.has(questionIdKey(id)));
      if (next.length !== this.favoriteQuestionIds.length) {
        this.favoriteQuestionIds = next;
      }
    },
    isFavorited(questionId: string) {
      return this.favoriteQuestionIds.includes(questionIdKey(questionId));
    },
    toggleFavorite(questionId: string) {
      const key = questionIdKey(questionId);
      if (this.favoriteQuestionIds.includes(key)) {
        this.favoriteQuestionIds = this.favoriteQuestionIds.filter(id => id !== key);
        useUiStore().showToast('已取消收藏', 'info');
      } else {
        this.favoriteQuestionIds.push(key);
        useUiStore().showToast('已收藏该题', 'success');
      }
    },
    toggleTag(questionId: string, tag: string) {
      const key = questionIdKey(questionId);
      const tags = new Set(this.questionTags[key] || []);
      if (tags.has(tag)) tags.delete(tag);
      else tags.add(tag);
      this.questionTags[key] = [...tags];
      if (this.questionTags[key].length === 0) delete this.questionTags[key];
    },
    addTag(questionId: string, tag: string) {
      const trimmed = tag.trim();
      if (!trimmed) return;
      const key = questionIdKey(questionId);
      if (!this.availableTags.includes(trimmed)) this.availableTags.push(trimmed);
      const tags = new Set(this.questionTags[key] || []);
      tags.add(trimmed);
      this.questionTags[key] = [...tags];
    },
    deleteTag(tag: string) {
      this.availableTags = this.availableTags.filter(t => t !== tag);
      Object.keys(this.questionTags).forEach(key => {
        const tags = new Set(this.questionTags[key] || []);
        if (tags.has(tag)) {
          tags.delete(tag);
          this.questionTags[key] = [...tags];
          if (this.questionTags[key].length === 0) delete this.questionTags[key];
        }
      });
    },
    async importSubject(subjectName: string, file: File, mode: 'append' | 'replace' | 'new' = 'new') {
      const ui = useUiStore();
      const questions = await parseQuestionFile(file);
      if (questions.length === 0) throw new Error('未找到格式正确的题目');
      const existing = this.subjects.find(subject => subject.name === subjectName);
      if (existing && mode === 'append') {
        existing.questions = [...existing.questions, ...questions];
        ui.showToast(`已追加 ${questions.length} 道题到「${subjectName}」`, 'success');
        return;
      }
      if (existing && mode === 'replace') {
        this.clearSubjectAssociatedData(existing.id);
        existing.questions = questions;
        ui.showToast(`已覆盖「${subjectName}」，共 ${questions.length} 道题`, 'success');
        return;
      }
      this.subjects.push({ id: genId(), name: subjectName, questions });
      ui.showToast(`成功导入 ${questions.length} 道题目到「${subjectName}」`, 'success');
    },
    renameSubject(subjectId: string, name: string) {
      const trimmed = name.trim();
      if (!trimmed) return;
      const subject = this.subjects.find(item => item.id === subjectId);
      if (!subject) return;
      subject.name = trimmed;
      this.wrongQuestions.forEach(question => {
        if (question.subjectId === subjectId) question.subjectName = trimmed;
      });
      this.examHistory.forEach(record => {
        if (record.subjectId === subjectId) record.subjectName = trimmed;
        record.questions?.forEach(question => {
          if (question.subjectId === subjectId) question.subjectName = trimmed;
        });
      });
    },
    deleteSubject(subjectId: string) {
      this.clearSubjectAssociatedData(subjectId);
      this.subjects = this.subjects.filter(subject => subject.id !== subjectId);
      useUiStore().showToast('题库已删除，相关数据已同步清理', 'success');
    },
    clearSubjectAssociatedData(subjectId: string) {
      const subject = this.subjects.find(item => item.id === subjectId);
      const subjectQuestionIds = new Set(subject?.questions.map(question => questionIdKey(question.id)) || []);

      // Only remove exam records that are scoped to this subject directly.
      // Cross-subject ("all") records containing questions from this subject
      // are kept intact — their questions from other subjects must not be lost.
      const removedRecordIds = new Set(
        this.examHistory
          .filter(record => record.subjectId === subjectId)
          .map(record => record.id)
      );
      this.wrongQuestions = this.wrongQuestions.filter(question => question.subjectId !== subjectId);
      this.examHistory = this.examHistory.filter(record => !removedRecordIds.has(record.id));
      this.practiceLog = this.practiceLog.filter(record =>
        record.subjectId !== subjectId &&
        (!record.sourceExamRecordId || !removedRecordIds.has(record.sourceExamRecordId))
      );
      Object.keys(this.questionTags).forEach(questionId => {
        if (subjectQuestionIds.has(questionId)) delete this.questionTags[questionId];
      });
      this.favoriteQuestionIds = this.favoriteQuestionIds.filter(id => !subjectQuestionIds.has(id));
      this.syncPracticeStats();
    },
    clearLibrary() {
      this.subjects = [];
      this.wrongQuestions = [];
      this.examHistory = [];
      this.practiceLog = [];
      this.questionTags = {};
      this.favoriteQuestionIds = [];
      this.practiceStats = { total: 0, correct: 0, practiced: 0 };
    },
    deduplicateLibrary() {
      const seen = new Map<string, string>();
      let removed = 0;
      this.subjects.forEach(subject => {
        subject.questions = subject.questions.filter(question => {
          const key = [
            question.question,
            question.optionA,
            question.optionB,
            question.optionC,
            question.optionD,
            question.answer
          ].join('||');
          if (seen.has(key)) {
            removed += 1;
            return false;
          }
          seen.set(key, question.id);
          return true;
        });
      });
      useUiStore().showToast(removed ? `已去除 ${removed} 道重复题` : '没有发现重复题', removed ? 'success' : 'info');
    },
    addWrongQuestions(records: WrongQuestion[]) {
      const seen = new Set<string>();
      const deduped = records.filter(question => {
        const key = questionIdKey(question.id);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const newWrongIds = new Set(deduped.map(question => questionIdKey(question.id)));
      this.wrongQuestions = this.wrongQuestions.filter(question => !newWrongIds.has(questionIdKey(question.id)));
      this.wrongQuestions = [...this.wrongQuestions, ...deduped];
    },
    removeWrongByIds(questionIds: string[]) {
      const ids = new Set(questionIds.map(questionIdKey));
      this.wrongQuestions = this.wrongQuestions.filter(question => !ids.has(questionIdKey(question.id)));
    },
    clearWrongQuestions() {
      this.wrongQuestions = [];
      this.syncPracticeStats();
    },
    addExamRecord(record: ExamRecord) {
      this.examHistory.unshift(record);
      if (this.examHistory.length > 50) {
        this.examHistory = this.examHistory.slice(0, 50);
        useUiStore().showToast('历史记录已达上限（50条），最早记录已自动删除', 'info');
      }
    },
    deleteExamRecord(recordId: string) {
      this.examHistory = this.examHistory.filter(record => record.id !== recordId);
      this.practiceLog = this.practiceLog.filter(record => record.sourceExamRecordId !== recordId);
      this.syncPracticeStats();
    },
    clearHistory() {
      const removedIds = new Set(this.examHistory.map(record => record.id));
      this.examHistory = [];
      this.practiceLog = this.practiceLog.filter(record => !record.sourceExamRecordId || !removedIds.has(record.sourceExamRecordId));
      this.syncPracticeStats();
    },
    addPracticeEntries(entries: PracticeLogEntry[]) {
      this.practiceLog = trimPracticeLog([...entries, ...this.practiceLog]);
      this.syncPracticeStats();
    },
    syncPracticeStats() {
      const consistency = ensurePracticeLogConsistency(this.practiceLog, this.examHistory);
      this.practiceLog = consistency.practiceLog;
      this.practiceStats = getPracticeLogSummary(this.practiceLog);
    },
    async restoreBackupFile(file: File) {
      const backup = await restoreBackup(file);
      this.applySnapshot(backup);
      useUiStore().showToast(`配置已恢复，包含 ${backup.subjects.length} 个学科`, 'success');
    },
    exportAllBackup() {
      downloadJson(exportBackup(this.snapshot()), `多学科题库-完整备份-${today()}.json`);
      useUiStore().showToast('配置已备份导出', 'success');
    },
    exportSubject(subjectId: string) {
      const subject = this.subjects.find(item => item.id === subjectId);
      if (!subject) return;
      downloadJson({ version: '2.0', timestamp: new Date().toISOString(), subjects: [subject] }, `${subject.name}-题库-${today()}.json`);
    },
    exportCurrentQuestions(subjectId: string | 'all', format: 'json' | 'text' | 'print') {
      const questions = subjectId === 'all'
        ? this.allQuestions
        : this.allQuestions.filter(q => q._subjectId === subjectId);
      if (format === 'json') {
        downloadJson(
          subjectId === 'all'
            ? { version: '2.0', timestamp: new Date().toISOString(), subjects: this.subjects }
            : { version: '2.0', timestamp: new Date().toISOString(), questions },
          `题库-${today()}.json`
        );
      } else if (format === 'text') {
        const text = questions.map((question, index) => `${index + 1}. ${question.question}
A. ${question.optionA}
B. ${question.optionB}
C. ${question.optionC}
D. ${question.optionD}
答案：${question.answer}`).join('\n\n');
        downloadText(text, `题库-${today()}.txt`);
      } else {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`<html><head><title>题库导出</title><style>body{font-family:serif;padding:36px;line-height:1.8}.q{margin-bottom:22px;page-break-inside:avoid}.a{color:#64748b}</style></head><body><h1>题库导出 (${questions.length}题)</h1>${questions.map((question, index) => `<div class="q"><strong>${index + 1}. ${question.question}</strong><div>A. ${question.optionA}</div><div>B. ${question.optionB}</div><div>C. ${question.optionC}</div><div>D. ${question.optionD}</div><div class="a">答案：${question.answer}</div></div>`).join('')}</body></html>`);
        printWindow.document.close();
        printWindow.print();
      }
    },
    async downloadTemplate(kind: 'excel' | 'json') {
      const sample = [{
        question: '中国近代史的开端是？',
        optionA: '鸦片战争',
        optionB: '甲午战争',
        optionC: '辛亥革命',
        optionD: '五四运动',
        answer: 'A'
      }];
      if (kind === 'json') {
        downloadJson({ questions: sample }, 'MultiQuiz-JSON题库模板.json');
        return;
      }
      const XLSX = await import('xlsx');
      const sheet = XLSX.utils.json_to_sheet(sample, {
        header: ['question', 'optionA', 'optionB', 'optionC', 'optionD', 'answer']
      });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, '题库模板');
      const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      downloadBlob(new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'MultiQuiz-Excel题库模板.xlsx');
    },
    snapshot(): AppStateSnapshot {
      return {
        subjects: this.subjects,
        wrongQuestions: this.wrongQuestions,
        practiceStats: this.practiceStats,
        examHistory: this.examHistory,
        practiceLog: this.practiceLog,
        questionTags: this.questionTags,
        favoriteQuestionIds: this.favoriteQuestionIds,
        browseAnswerMode: this.browseAnswerMode,
        migratedLegacyQuestions: 0,
        repairedQuestionIds: false
      };
    }
  }
});
