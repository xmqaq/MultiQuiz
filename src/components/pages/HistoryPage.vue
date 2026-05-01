<script setup lang="ts">
import { computed } from 'vue';
import type { ExamRecord } from '@/types';
import { useExamStore } from '@/stores/exam';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { downloadJson, escapeHtml, formatDateTime, today } from '@/services/utils';
import TabIcon from '@/components/common/TabIcon.vue';

const library = useLibraryStore();
const exam = useExamStore();
const ui = useUiStore();

const records = computed(() => library.examHistory);

const avgScore = computed(() => {
  if (!records.value.length) return 0;
  return Math.round(records.value.reduce((sum, r) => sum + r.score, 0) / records.value.length);
});

const maxScore = computed(() => {
  if (!records.value.length) return 0;
  return Math.max(...records.value.map(r => r.score));
});

const lastPractice = computed(() => {
  if (!records.value.length) return '—';
  return formatDateTime(records.value[0].date);
});

const lastPracticeParts = computed(() => {
  const [date, time = ''] = lastPractice.value.split(' ');
  return { date, time };
});

function scoreTone(score: number) {
  if (score >= 85) return 'excellent';
  if (score >= 60) return 'pass';
  return 'low';
}

function viewDetail(record: ExamRecord) {
  const html = `
    <div class="detail-summary">
      <div><strong>${record.score}分</strong><span>得分</span></div>
      <div><strong>${record.correct}/${record.totalQuestions}</strong><span>正确</span></div>
      <div><strong>${record.duration}min</strong><span>用时</span></div>
    </div>
    <div class="detail-questions">
      ${record.questions.map((question, index) => `
        <div class="detail-q ${question.userAnswer === question.correctAnswer ? 'correct' : 'wrong'}">
          <strong>${index + 1}. ${escapeHtml(question.question)}</strong>
          <div>A. ${escapeHtml(question.optionA)}</div>
          <div>B. ${escapeHtml(question.optionB)}</div>
          <div>C. ${escapeHtml(question.optionC)}</div>
          <div>D. ${escapeHtml(question.optionD)}</div>
          <p>正确答案：${escapeHtml(question.correctAnswer)} | 你的答案：${escapeHtml(question.userAnswer)}</p>
        </div>
      `).join('')}
    </div>
  `;
  ui.showHtmlModal(`考试详情 · ${record.subjectName}`, html, [{ label: '关闭', style: 'secondary', action: () => {} }]);
}

function deleteRecord(record: ExamRecord) {
  ui.showModal('删除考试记录', '确定删除这条考试记录？统计数据会同步更新。', [
    { label: '删除', style: 'danger', action: () => {
      library.deleteExamRecord(record.id);
      ui.showToast('记录已删除', 'success');
    }},
    { label: '取消', style: 'ghost', action: () => {} }
  ]);
}

function exportHistory() {
  if (library.examHistory.length === 0) {
    ui.showToast('暂无记录', 'warning');
    return;
  }
  downloadJson({ exportDate: new Date().toISOString(), records: library.examHistory }, `考试记录-${today()}.json`);
}

function clearHistory() {
  if (library.examHistory.length === 0) {
    ui.showToast('暂无记录', 'info');
    return;
  }
  ui.showModal('清空考试记录', `确定清空全部 ${library.examHistory.length} 条考试记录？`, [
    { label: '清空记录', style: 'danger', action: () => {
      library.clearHistory();
      ui.showToast('考试记录已清空', 'success');
    }},
    { label: '取消', style: 'ghost', action: () => {} }
  ]);
}
</script>

<template>
  <section class="page history-page">

    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">考试记录</h1>
        <p class="page-subtitle">{{ records.length ? `共 ${records.length} 次练习记录` : '历次模拟考试成绩' }}</p>
      </div>
      <div class="header-actions">
        <button v-if="records.length" class="btn btn-secondary" type="button" @click="exportHistory">导出记录</button>
        <button v-if="records.length" class="btn btn-ghost btn-sm" type="button" @click="clearHistory">清空</button>
      </div>
    </div>

    <!-- Overview -->
    <div v-if="records.length" class="overview-grid">
      <div class="overview-card overview-card-count">
        <span class="overview-icon" aria-hidden="true"><TabIcon name="history" /></span>
        <span class="metric-number">{{ records.length }}</span>
        <span class="metric-label">考试次数</span>
      </div>
      <div class="overview-card overview-card-average">
        <span class="overview-icon" aria-hidden="true"><TabIcon name="stats" /></span>
        <span class="metric-number">{{ avgScore }}</span>
        <span class="metric-label">平均得分</span>
      </div>
      <div class="overview-card overview-card-best">
        <span class="overview-icon" aria-hidden="true"><TabIcon name="target" /></span>
        <span class="metric-number">{{ maxScore }}</span>
        <span class="metric-label">最高得分</span>
      </div>
      <div class="overview-card overview-card-recent">
        <span class="overview-icon" aria-hidden="true"><TabIcon name="lightning" /></span>
        <span class="metric-number recent-date">{{ lastPracticeParts.date }}</span>
        <span class="recent-time">{{ lastPracticeParts.time }}</span>
        <span class="metric-label">最近练习</span>
      </div>
    </div>

    <div v-if="records.length && records.length < 3" class="card-container history-hint">
      更多练习后将生成更稳定的成绩趋势和复习节奏判断。
    </div>

    <!-- Empty -->
    <div v-if="records.length === 0" class="empty-state">
      <div class="empty-title">暂无考试记录</div>
      <div class="empty-desc">完成一次模拟答题后，记录将显示在这里。</div>
      <button class="btn btn-primary" type="button" @click="ui.switchTab('exam')">去练习</button>
    </div>

    <!-- Record List -->
    <div v-else class="history-list">
      <article v-for="record in records" :key="record.id" class="card-container history-item">
        <div class="history-score" :class="scoreTone(record.score)">
          <strong>{{ record.score }}</strong>
          <span>分</span>
        </div>
        <div class="history-main">
          <h3>{{ record.subjectName }}</h3>
          <p>{{ formatDateTime(record.date) }} · {{ record.correct }}/{{ record.totalQuestions }} 正确 · {{ record.duration }} 分钟</p>
        </div>
        <div class="history-actions">
          <button class="btn btn-sm btn-primary" type="button" @click="viewDetail(record)">
            <TabIcon name="browse" />
            详情
          </button>
          <button class="btn btn-sm btn-secondary" type="button" @click="exam.retake(record)">
            <TabIcon name="exam" />
            重做
          </button>
          <button class="btn btn-sm btn-ghost" type="button" @click="deleteRecord(record)">
            <TabIcon name="wrong" />
            删除
          </button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>

.overview-card {
  position: relative;
}

.overview-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
}

.overview-icon :deep(.tab-icon-svg) {
  width: 15px;
  height: 15px;
}

.overview-card-count .overview-icon {
  color: var(--primary);
  background: var(--primary-surface);
}

.overview-card-average .overview-icon {
  color: var(--accent);
  background: var(--teal-50);
}

.overview-card-best .overview-icon {
  color: var(--success);
  background: var(--success-light);
}

.overview-card-recent .overview-icon {
  color: var(--highlight);
  background: var(--highlight-light);
}

.recent-date {
  font-size: var(--text-card-title);
  line-height: 1.2;
}

.recent-time {
  color: var(--text-muted);
  font-size: var(--text-caption);
  line-height: 1.2;
}

.history-hint {
  margin-bottom: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--text-muted);
  font-size: var(--text-body);
}

.history-list {
  width: 100%;
}

.history-item {
  display: grid;
  grid-template-columns: 50px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  box-shadow: none;
}

.history-score {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
}

.history-score.excellent {
  background: var(--success-light);
  color: var(--success);
}

.history-score.pass {
  background: var(--blue-100);
  color: var(--primary-dark);
}

.history-score.low {
  background: var(--danger-light);
  color: var(--danger);
}

.history-score strong {
  font-size: var(--text-card-title);
}

.history-actions {
  gap: var(--space-2);
}

.history-actions :deep(.tab-icon-svg) {
  width: 14px;
  height: 14px;
}

.history-actions .btn-ghost {
  color: var(--text-muted);
}

@media (max-width: 900px) {
  .history-list {
    width: 100%;
  }

  .history-item {
    grid-template-columns: 50px minmax(0, 1fr);
  }

  .history-actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-start;
    gap: var(--space-2);
  }

  .history-actions .btn-primary,
  .history-actions .btn-secondary {
    flex: 1;
  }

  .history-actions .btn-ghost {
    flex: 0 0 auto;
    padding: 0 12px;
  }
}
</style>
