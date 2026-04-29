import { defineStore } from 'pinia';
import { useLibraryStore } from './library';

interface TrendPoint {
  date: string;
  label: string;
  questions: number;
  correct: number;
}

export const useStatsStore = defineStore('stats', {
  state: () => ({
    period: '7' as '7' | '30' | 'all'
  }),
  getters: {
    totalQuestions(): number {
      return useLibraryStore().totalQuestions;
    },
    practicedCount(): number {
      return useLibraryStore().practiceStats.practiced || 0;
    },
    accuracyRate(): number {
      const stats = useLibraryStore().practiceStats;
      return stats.practiced > 0 ? Math.round((stats.correct / stats.practiced) * 100) : 0;
    },
    wrongCount(): number {
      return useLibraryStore().wrongQuestions.length;
    },
    subjectDistribution() {
      const library = useLibraryStore();
      const total = Math.max(1, library.totalQuestions);
      return library.subjects.map(subject => ({
        id: subject.id,
        name: subject.name,
        count: subject.questions.length,
        percent: Math.round((subject.questions.length / total) * 100)
      }));
    },
    practiceTrend: (state): TrendPoint[] => {
      const library = useLibraryStore();
      const now = new Date();
      const data = new Map<string, { date: string; questions: number; correct: number }>();
      library.practiceLog
        .filter(record => record.mode !== 'legacy')
        .forEach(record => {
          const date = new Date(record.date);
          const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
          if (state.period === '7' && diff > 7) return;
          if (state.period === '30' && diff > 30) return;
          const key = date.toLocaleDateString('zh-CN');
          const item = data.get(key) || { date: key, questions: 0, correct: 0 };
          item.questions += record.totalQuestions;
          item.correct += record.correct;
          data.set(key, item);
        });
      const days = state.period === '7' ? 7 : state.period === '30' ? 30 : Math.max(30, data.size || 0);
      return Array.from({ length: days }, (_, index) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (days - 1 - index));
        const key = date.toLocaleDateString('zh-CN');
        const item = data.get(key);
        return {
          date: key,
          label: `${date.getMonth() + 1}/${date.getDate()}`,
          questions: item?.questions || 0,
          correct: item?.correct || 0
        };
      });
    },
    heatmapDays() {
      const library = useLibraryStore();
      const byDate = new Map<string, number>();
      library.practiceLog.forEach(record => {
        const key = new Date(record.date).toLocaleDateString('zh-CN');
        byDate.set(key, (byDate.get(key) || 0) + record.totalQuestions);
      });
      const now = new Date();
      return Array.from({ length: 84 }, (_, index) => {
        const date = new Date(now);
        date.setDate(date.getDate() - (83 - index));
        const key = date.toLocaleDateString('zh-CN');
        const value = byDate.get(key) || 0;
        return { date: key, value, level: value === 0 ? 0 : value < 20 ? 1 : value < 50 ? 2 : value < 100 ? 3 : 4 };
      });
    }
  },
  actions: {
    setPeriod(period: '7' | '30' | 'all') {
      this.period = period;
    }
  }
});
