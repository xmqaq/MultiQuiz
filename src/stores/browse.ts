import { defineStore } from 'pinia';
import type { Question } from '@/types';
import { questionIdKey } from '@/services/utils';
import { useLibraryStore } from './library';

export const useBrowseStore = defineStore('browse', {
  state: () => ({
    subjectFilter: 'all',
    tagFilter: 'all',
    favoriteFilter: 'all',
    search: '',
    answerMode: 'show' as 'show' | 'hide',
    revealedAnswers: [] as string[]
  }),
  getters: {
    availableTags(): string[] {
      const library = useLibraryStore();
      const tags = new Set<string>();
      Object.values(library.questionTags).forEach(list => list.forEach(tag => tags.add(tag)));
      library.availableTags.forEach(tag => tags.add(tag));
      return [...tags];
    },
    filteredQuestions(): Question[] {
      const library = useLibraryStore();
      let pool = this.subjectFilter === 'all'
        ? library.allQuestions
        : library.allQuestions.filter(q => q._subjectId === this.subjectFilter);

      const keyword = this.search.trim().toLowerCase();
      if (keyword) {
        pool = pool.filter(question => [
          question.question,
          question.optionA,
          question.optionB,
          question.optionC,
          question.optionD
        ].some(text => text.toLowerCase().includes(keyword)));
      }

      if (this.tagFilter === 'untagged') {
        pool = pool.filter(question => !(library.questionTags[questionIdKey(question.id)] || []).length);
      } else if (this.tagFilter !== 'all') {
        pool = pool.filter(question => library.questionTags[questionIdKey(question.id)]?.includes(this.tagFilter));
      }

      if (this.favoriteFilter === 'favorited') {
        pool = pool.filter(question => library.isFavorited(question.id));
      } else if (this.favoriteFilter === 'unfavorited') {
        pool = pool.filter(question => !library.isFavorited(question.id));
      }

      return pool;
    },
    summary(): string {
      const parts: string[] = [];
      const library = useLibraryStore();
      const subject = library.subjects.find(item => item.id === this.subjectFilter);
      if (subject) parts.push(subject.name);
      if (this.tagFilter === 'untagged') parts.push('无标签');
      else if (this.tagFilter !== 'all') parts.push(this.tagFilter);
      if (this.favoriteFilter === 'favorited') parts.push('仅收藏');
      if (this.favoriteFilter === 'unfavorited') parts.push('未收藏');
      if (this.search.trim()) parts.push(`搜索「${this.search.trim()}」`);
      return parts.length ? parts.join(' · ') : '全部题目';
    }
  },
  actions: {
    init(mode: 'show' | 'hide') {
      this.answerMode = mode;
    },
    toggleAnswerMode() {
      this.answerMode = this.answerMode === 'hide' ? 'show' : 'hide';
      if (this.answerMode === 'show') this.revealedAnswers = [];
    },
    shouldShowAnswer(questionId: string) {
      return this.answerMode === 'show' || this.revealedAnswers.includes(questionIdKey(questionId));
    },
    toggleQuestionReveal(questionId: string) {
      const key = questionIdKey(questionId);
      if (this.revealedAnswers.includes(key)) {
        this.revealedAnswers = this.revealedAnswers.filter(id => id !== key);
      } else {
        this.revealedAnswers.push(key);
      }
    }
  }
});
