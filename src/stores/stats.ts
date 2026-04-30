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
    /**
     * Consistent UTC date key to avoid timezone skew.
     * All record dates are stored as ISO (UTC) and chart frames are
     * computed from the same UTC baseline so keys always match.
     */
    practiceTrend: (state): TrendPoint[] => {
      const library = useLibraryStore();
      const now = new Date();
      const data = new Map<string, { questions: number; correct: number }>();
      library.practiceLog
        .filter(record => record.mode !== 'legacy')
        .forEach(record => {
          const key = new Date(record.date).toISOString().slice(0, 10);
          const diff = Math.floor((now.getTime() - new Date(record.date).getTime()) / 86400000);
          if (state.period === '7' && diff > 7) return;
          if (state.period === '30' && diff > 30) return;
          const item = data.get(key) || { questions: 0, correct: 0 };
          item.questions += record.totalQuestions;
          item.correct += record.correct;
          data.set(key, item);
        });
      const days = state.period === '7' ? 7 : state.period === '30' ? 30 : Math.max(30, data.size || 0);
      return Array.from({ length: days }, (_, index) => {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - (days - 1 - index));
        const key = date.toISOString().slice(0, 10);
        const item = data.get(key);
        return {
          date: key,
          label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
          questions: item?.questions || 0,
          correct: item?.correct || 0
        };
      });
    },
    heatmapDays() {
      const library = useLibraryStore();
      const now = new Date();
      const byDate = new Map<string, number>();
      library.practiceLog.forEach(record => {
        const key = new Date(record.date).toISOString().slice(0, 10);
        byDate.set(key, (byDate.get(key) || 0) + record.totalQuestions);
      });
      return Array.from({ length: 84 }, (_, index) => {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() - (83 - index));
        const key = date.toISOString().slice(0, 10);
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
