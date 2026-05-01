<script setup lang="ts">
import { computed } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useStatsStore } from '@/stores/stats';
import { useUiStore } from '@/stores/ui';
import TabIcon from '@/components/common/TabIcon.vue';

const library = useLibraryStore();
const stats = useStatsStore();
const ui = useUiStore();

const maxTrend = computed(() => Math.max(1, ...stats.practiceTrend.map((item: { questions: number }) => item.questions)));
const hasPractice = computed(() => stats.practicedCount > 0);
const accuracyStyle = computed<Record<string, string>>(() => ({ '--accuracy': `${Math.max(stats.accuracyRate, 5)}%` }));

const hasTrendData = computed(() => stats.practiceTrend.some((item: { questions: number }) => item.questions > 0));
const hasHeatmapData = computed(() => stats.heatmapDays.some((day: { value: number }) => day.value > 0));
const accuracyDisplay = computed(() => hasPractice.value ? `${stats.accuracyRate}%` : '--');
const accuracyHint = computed(() => {
  if (!hasPractice.value) return '完成练习后生成';
  if (stats.accuracyRate >= 80) return '表现优秀';
  if (stats.accuracyRate >= 60) return '稳步提升';
  return '需要加强';
});

const weakestSubject = computed(() => {
  if (!hasPractice.value) return null;

  const wrongBySubject = new Map<string, { name: string; count: number }>();
  library.wrongQuestions.forEach(question => {
    const item = wrongBySubject.get(question.subjectId) || { name: question.subjectName, count: 0 };
    item.count += 1;
    wrongBySubject.set(question.subjectId, item);
  });
  const wrongSubjects = Array.from(wrongBySubject.values()).filter(item => item.count > 0);
  if (wrongSubjects.length > 0) {
    const target = wrongSubjects.reduce((a, b) => a.count >= b.count ? a : b);
    return {
      name: target.name,
      reason: '待复习错题最多',
      detail: `${target.count} 道待复习`
    };
  }

  const practiceBySubject = new Map<string, { name: string; total: number; correct: number }>();
  library.practiceLog
    .filter(record => record.mode !== 'legacy')
    .forEach(record => {
      const item = practiceBySubject.get(record.subjectId) || { name: record.subjectName, total: 0, correct: 0 };
      item.total += record.totalQuestions;
      item.correct += record.correct;
      practiceBySubject.set(record.subjectId, item);
    });
  const practicedSubjects = Array.from(practiceBySubject.values()).filter(item => item.total > 0);
  if (practicedSubjects.length < 2) return null;

  const target = practicedSubjects.reduce((a, b) => {
    const aRate = a.correct / Math.max(1, a.total);
    const bRate = b.correct / Math.max(1, b.total);
    return aRate <= bRate ? a : b;
  });
  return {
    name: target.name,
    reason: '当前正确率较低',
    detail: `正确率 ${Math.round((target.correct / Math.max(1, target.total)) * 100)}%`
  };
});

const insight = computed(() => {
  if (!hasPractice.value) return null;
  const rate = stats.accuracyRate;
  if (rate >= 80) return { tone: 'good' as const, title: '正确率优秀，继续保持！', desc: '当前表现稳定，可以尝试更多学科拓展知识面。' };
  if (rate >= 60) return { tone: 'ok' as const, title: '还有提升空间', desc: '建议集中练习错题，巩固薄弱知识点。' };
  return { tone: 'warn' as const, title: '建议从错题强化开始', desc: `当前正确率为 ${rate}%，建议优先从 ${stats.wrongCount} 道错题开始复习，再进行专项练习。` };
});
</script>

<template>
  <section class="page page-wide stats-page-v2">

    <!-- Page Header -->
    <div class="stats-header">
      <div class="stats-header-left">
        <h1 class="page-title">统计分析</h1>
        <p class="stats-header-sub">
          <template v-if="hasPractice">
            累计 <strong>{{ stats.practicedCount }}</strong> 道练习 · 正确率 <strong>{{ stats.accuracyRate }}%</strong> · 待复习 <strong>{{ stats.wrongCount }}</strong> 道
          </template>
          <template v-else>
            完成模拟答题后查看学习数据
          </template>
        </p>
      </div>
    </div>

    <!-- Insight Banner -->
    <div v-if="insight" class="insight-banner" :class="`insight-${insight.tone}`">
      <div class="insight-text">
        <span class="insight-icon">{{ insight.tone === 'good' ? '✓' : insight.tone === 'warn' ? '!' : '→' }}</span>
        <div>
          <strong class="insight-title">{{ insight.title }}</strong>
          <p class="insight-desc">{{ insight.desc }}</p>
        </div>
      </div>
      <div class="insight-metrics">
        <div class="insight-metric"><span class="insight-val">{{ stats.accuracyRate }}%</span><span class="insight-label">正确率</span></div>
        <div class="insight-metric"><span class="insight-val">{{ stats.wrongCount }}</span><span class="insight-label">待复习</span></div>
        <div class="insight-metric"><span class="insight-val">{{ stats.practicedCount }}</span><span class="insight-label">累计练习</span></div>
      </div>
      <button
        v-if="library.wrongQuestions.length"
        class="btn btn-primary"
        type="button"
        @click="ui.switchTab('wrong')"
      >开始错题强化</button>
    </div>

    <!-- No-practice empty state -->
    <div v-if="!hasPractice" class="insight-banner insight-empty">
      <div class="insight-text">
        <span class="insight-icon empty">i</span>
        <div>
          <strong class="insight-title">准备开始学习</strong>
          <p class="insight-desc">已导入 {{ library.subjects.length }} 个学科、{{ stats.totalQuestions }} 道题。完成一次模拟答题后，这里会生成你的学习表现分析。</p>
        </div>
      </div>
      <button class="btn btn-primary" type="button" @click="ui.switchTab('exam')">开始练习</button>
    </div>

    <!-- Core Metrics -->
    <div class="metrics-row">
      <div class="metric-box metric-box-questions">
        <span class="metric-icon" aria-hidden="true"><TabIcon name="layers" /></span>
        <span class="metric-box-num">{{ stats.totalQuestions }}</span>
        <span class="metric-box-label">题库总量</span>
        <span class="metric-box-hint">{{ library.subjects.length }} 个学科</span>
      </div>
      <div class="metric-box metric-box-practice">
        <span class="metric-icon" aria-hidden="true"><TabIcon name="lightning" /></span>
        <span class="metric-box-num">{{ stats.practicedCount }}</span>
        <span class="metric-box-label">累计练习</span>
        <span class="metric-box-hint">{{ hasPractice ? '道题已练习' : '等待开始' }}</span>
      </div>
      <div class="metric-box metric-box-accuracy">
        <span class="metric-icon" aria-hidden="true"><TabIcon name="target" /></span>
        <span class="metric-box-num" :class="{ 'text-success': hasPractice && stats.accuracyRate >= 80, 'text-warn': hasPractice && stats.accuracyRate < 60 }">{{ accuracyDisplay }}</span>
        <span class="metric-box-label">正确率</span>
        <span class="metric-box-hint">{{ accuracyHint }}</span>
      </div>
      <div class="metric-box metric-box-review">
        <span class="metric-icon" aria-hidden="true"><TabIcon name="wrong" /></span>
        <span class="metric-box-num">{{ stats.wrongCount }}</span>
        <span class="metric-box-label">待复习</span>
        <span class="metric-box-hint">{{ stats.wrongCount > 0 ? '道错题待巩固' : '暂无错题' }}</span>
      </div>
    </div>

    <!-- Analysis Body: two columns -->
    <div class="analysis-grid">
      <!-- Left column -->
      <div class="analysis-left">

        <!-- Heatmap -->
        <div class="card-container analysis-card">
          <div class="analysis-card-header">
            <div>
              <h3 class="analysis-card-title">学习热力图</h3>
              <span class="analysis-card-sub">最近 12 周练习分布</span>
            </div>
            <div class="heatmap-legend">
              <span /><span /><span /><span />
            </div>
          </div>
          <div class="heatmap">
            <span
              v-for="day in stats.heatmapDays"
              :key="day.date"
              class="heatmap-cell"
              :class="`level-${day.level}`"
              :title="`${day.date}: ${day.value} 题`"
            />
          </div>
          <p v-if="!hasHeatmapData" class="heatmap-note">
            练习数据还在积累中，完成练习后将逐步点亮热力图。
          </p>
          <p v-else-if="stats.practicedCount < 30" class="heatmap-note">
            数据还在积累中，热力图会随着每日练习逐步呈现节奏。
          </p>
        </div>

        <!-- Subject Distribution -->
        <div class="card-container analysis-card">
          <div class="analysis-card-header">
            <div>
              <h3 class="analysis-card-title">学科分布</h3>
              <span class="analysis-card-sub">{{ library.subjects.length }} 个学科</span>
            </div>
          </div>
          <div v-if="library.subjects.length === 0" class="empty-state compact">暂无数据</div>
          <div v-else class="dist-list">
            <div v-for="subject in stats.subjectDistribution" :key="subject.id" class="dist-row">
              <span class="dist-name">{{ subject.name }}</span>
              <div class="dist-track"><div :style="{ width: `${Math.max(subject.percent, 3)}%` }" /></div>
              <strong class="dist-count">{{ subject.count }}</strong>
            </div>
          </div>
        </div>
      </div>

      <!-- Right column -->
      <div class="analysis-right">

        <!-- Accuracy analysis -->
        <div v-if="hasPractice" class="card-container analysis-card accuracy-card">
          <h3 class="analysis-card-title accuracy-title">正确率</h3>
          <div class="accuracy-body">
            <div class="accuracy-ring" :style="accuracyStyle">
              <span>{{ stats.accuracyRate }}%</span>
            </div>
            <div class="accuracy-info">
              <strong>{{ hasPractice ? (stats.accuracyRate >= 80 ? '表现优秀' : stats.accuracyRate >= 60 ? '继续努力' : '需要加强') : '暂无数据' }}</strong>
              <p>{{ hasPractice ? `${stats.practicedCount} 道题计入统计，${stats.accuracyRate >= 80 ? '错误率较低，知识掌握扎实。' : stats.accuracyRate >= 60 ? '建议针对错题加强练习。' : '建议优先完成错题复习再开始新练习。'}` : '完成答题练习后，这里会显示你的综合正确率。' }}</p>
            </div>
          </div>
        </div>
        <div v-else class="card-container analysis-card pending-card">
          <h3 class="analysis-card-title">学习分析待生成</h3>
          <p>完成模拟答题后，这里会展示你的综合正确率、练习表现和复习建议。</p>
        </div>

        <!-- Weakest Subject -->
        <div v-if="hasPractice && weakestSubject" class="card-container analysis-card weak-card">
          <h3 class="analysis-card-title weak-title">
            <span class="analysis-title-icon" aria-hidden="true"><TabIcon name="wrong" /></span>
            薄弱环节
          </h3>
          <p class="weak-desc">{{ weakestSubject.reason }}</p>
          <div class="weak-subject-row">
            <span class="subject-tag">{{ weakestSubject.name }}</span>
            <span class="weak-count">{{ weakestSubject.detail }}</span>
          </div>
          <p class="weak-suggestion">建议先完成该学科错题，再进行一次快速练习巩固。</p>
          <button
            v-if="library.wrongQuestions.length"
            class="btn btn-secondary btn-block weak-action"
            type="button"
            @click="ui.switchTab('wrong')"
          >练习错题</button>
        </div>
        <div v-else class="card-container analysis-card pending-card">
          <h3 class="analysis-card-title">{{ hasPractice ? '数据积累中' : '学习建议' }}</h3>
          <p>{{ hasPractice ? '继续完成更多不同学科的练习后，系统将识别更可靠的薄弱环节。' : '完成一次模拟答题后，系统将根据正确率、错题数量和练习记录识别需要加强的学科。' }}</p>
        </div>

      </div>
    </div>

    <!-- Trend -->
    <div class="card-container analysis-card">
      <div class="analysis-card-header">
        <div>
          <h3 class="analysis-card-title">练习趋势</h3>
          <span class="analysis-card-sub">{{ hasPractice ? '每日练习量' : '等待数据积累' }}</span>
        </div>
        <div class="period-tabs">
          <button :class="{ active: stats.period === '7' }" type="button" @click="stats.setPeriod('7')">7天</button>
          <button :class="{ active: stats.period === '30' }" type="button" @click="stats.setPeriod('30')">30天</button>
          <button :class="{ active: stats.period === 'all' }" type="button" @click="stats.setPeriod('all')">全部</button>
        </div>
      </div>
      <div v-if="!hasTrendData" class="trend-empty">
        <strong>等待练习记录</strong>
        <span>完成更多练习后，这里会展示你的练习趋势。</span>
      </div>
      <div v-else class="trend-chart" :class="`trend-period-${stats.period}`">
        <div
          v-for="(item, index) in stats.practiceTrend"
          :key="item.date"
          class="trend-bar"
          :class="{ 'is-empty': item.questions === 0 }"
          :title="`${item.date}: ${item.questions} 题`"
        >
          <strong v-if="item.questions > 0 || stats.period === '7'" class="trend-value">{{ item.questions }}</strong>
          <div class="trend-fill" :style="{ height: `${Math.max(4, item.questions / maxTrend * 100)}%` }" />
          <span
            :class="{ muted: stats.period === '30' && index % 5 !== 0 && index !== stats.practiceTrend.length - 1 }"
          >{{ item.label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Layout */
.stats-page-v2 {
  display: grid;
  gap: var(--section-gap);
}

/* ── Header ── */
.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-4);
  flex-wrap: wrap;
}

.stats-header-left {
  min-width: 0;
}

.stats-header .page-title {
  margin: 0;
}

.stats-header-sub {
  margin: var(--space-1) 0 0;
  font-size: var(--text-body);
  color: var(--text-muted);
  max-width: 560px;
}

.stats-header-sub strong {
  color: var(--text-soft);
  font-weight: var(--weight-semibold);
}

/* ── Insight Banner ── */
.insight-banner {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  border: 1px solid var(--border-soft);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  min-height: 72px;
  flex-wrap: wrap;
}

.insight-banner.insight-warn {
  border-color: rgba(217, 74, 74, 0.15);
  background: var(--red-50);
}

.insight-banner.insight-ok {
  border-color: rgba(196, 138, 50, 0.15);
  background: var(--amber-50);
}

.insight-banner.insight-good {
  border-color: rgba(45, 159, 94, 0.12);
  background: var(--green-50);
}

.insight-empty {
  border-color: rgba(69, 94, 221, 0.1);
  background: var(--blue-50);
}

.insight-text {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  flex: 1;
  min-width: 200px;
}

.insight-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-weight: var(--weight-extrabold);
  font-size: var(--text-caption);
  flex-shrink: 0;
}

.insight-icon.empty {
  background: var(--primary-surface);
  color: var(--primary);
}

.insight-warn .insight-icon {
  background: var(--danger-light);
  color: var(--danger);
}

.insight-ok .insight-icon {
  background: var(--highlight-light);
  color: var(--highlight);
}

.insight-good .insight-icon {
  background: var(--success-light);
  color: var(--success);
}

.insight-title {
  font-size: var(--text-card-title);
  font-weight: var(--weight-semibold);
  color: var(--text);
  display: block;
}

.insight-desc {
  margin: 2px 0 0;
  font-size: var(--text-caption);
  color: var(--text-muted);
  line-height: var(--leading-relaxed);
  max-width: 480px;
}

.insight-metrics {
  display: flex;
  gap: var(--space-4);
  flex-shrink: 0;
}

.insight-metric {
  display: grid;
  gap: 1px;
  text-align: center;
}

.insight-val {
  font-size: var(--text-card-title);
  font-weight: var(--weight-extrabold);
  color: var(--text);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.insight-label {
  font-size: var(--text-caption);
  color: var(--text-muted);
}

/* ── Metrics Row ── */
.metrics-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}

.metric-box {
  position: relative;
  display: grid;
  gap: 4px;
  align-content: center;
  min-height: 72px;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: none;
  overflow: hidden;
}

.metric-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--primary);
  background: var(--primary-surface);
  opacity: 0.8;
}

.metric-icon :deep(.tab-icon-svg) {
  width: 15px;
  height: 15px;
}

.metric-box-questions .metric-icon {
  color: var(--primary);
  background: var(--primary-surface);
}

.metric-box-practice .metric-icon {
  color: var(--accent);
  background: var(--teal-50);
}

.metric-box-accuracy .metric-icon {
  color: var(--success);
  background: var(--success-light);
}

.metric-box-review .metric-icon {
  color: var(--highlight);
  background: var(--highlight-light);
}

.metric-box-num {
  font-size: var(--text-metric-lg);
  font-weight: var(--weight-extrabold);
  color: var(--text);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
  max-width: calc(100% - 40px);
  margin-top: 4px;
}

.metric-box-num.text-success { color: var(--success); }
.metric-box-num.text-warn { color: var(--danger); }

.metric-box-label {
  font-size: var(--text-caption);
  font-weight: var(--weight-medium);
  color: var(--text-muted);
  max-width: calc(100% - 40px);
}

.metric-box-hint {
  font-size: var(--text-caption);
  color: var(--gray-400);
  max-width: calc(100% - 40px);
  margin-top: 2px;
}

/* ── Analysis Grid ── */
.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: var(--space-4);
  align-items: stretch;
}

.analysis-left,
.analysis-right {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--space-4);
  align-content: stretch;
}

.analysis-left > .analysis-card,
.analysis-right > .analysis-card {
  min-height: 0;
}

.analysis-card {
  padding: var(--card-padding);
}

.analysis-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.analysis-card-title {
  margin: 0;
  font-size: var(--text-card-title);
  font-weight: var(--weight-bold);
  color: var(--text);
}

.analysis-card-sub {
  display: block;
  margin-top: 2px;
  font-size: var(--text-caption);
  color: var(--text-muted);
}

/* ── Accuracy Card ── */
.accuracy-body {
  display: flex;
  gap: var(--space-4);
  align-items: center;
}

.accuracy-ring {
  display: grid;
  place-items: center;
  width: 88px;
  aspect-ratio: 1;
  border-radius: 50%;
  flex-shrink: 0;
  background:
    radial-gradient(circle at center, #fff 0 56%, transparent 57%),
    conic-gradient(var(--primary) var(--accuracy), var(--gray-100) 0);
}

.accuracy-ring span {
  font-size: var(--text-section-title);
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: var(--text);
}

.accuracy-info strong {
  font-size: var(--text-body);
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.accuracy-info p {
  margin: 4px 0 0;
  font-size: var(--text-caption);
  color: var(--text-muted);
  line-height: var(--leading-relaxed);
}

.pending-card {
  display: grid;
  gap: var(--space-2);
  align-content: start;
}

.pending-card p {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
}

.accuracy-title,
.weak-title {
  margin-bottom: var(--space-2);
}

.analysis-title-icon {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  margin-right: 6px;
  border-radius: var(--radius-sm);
  color: var(--highlight);
  background: var(--highlight-light);
  vertical-align: -5px;
}

.analysis-title-icon :deep(.tab-icon-svg) {
  width: 14px;
  height: 14px;
}

.heatmap-legend {
  display: flex;
  gap: 4px;
  align-items: center;
}

.heatmap-legend span {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: var(--gray-100);
}

.heatmap-legend span:nth-child(2) { background: rgba(69, 94, 221, 0.3); }
.heatmap-legend span:nth-child(3) { background: rgba(69, 94, 221, 0.6); }
.heatmap-legend span:nth-child(4) { background: var(--primary); }

.heatmap {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(14px, 1fr));
  gap: 4px;
  margin-top: var(--space-3);
}

.heatmap-cell {
  aspect-ratio: 1;
  border-radius: 3px;
  background: var(--gray-100);
}

.heatmap-cell.level-1 { background: rgba(69, 94, 221, 0.3); }
.heatmap-cell.level-2 { background: rgba(69, 94, 221, 0.6); }
.heatmap-cell.level-3 { background: var(--primary); }
.heatmap-cell.level-4 { background: var(--primary-dark); }

.heatmap-note {
  margin: var(--space-3) 0 0;
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.dist-list {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.dist-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.dist-name {
  width: 80px;
  font-size: var(--text-caption);
  color: var(--text-soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dist-track {
  flex: 1;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--gray-100);
  overflow: hidden;
}

.dist-track div {
  height: 100%;
  background: var(--primary);
  border-radius: var(--radius-full);
}

.dist-count {
  width: 32px;
  text-align: right;
  font-size: var(--text-caption);
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.weak-desc {
  margin: 0 0 var(--space-3);
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.weak-subject-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid rgba(196, 138, 50, 0.16);
  border-radius: var(--radius-md);
  background: linear-gradient(135deg, var(--amber-50), var(--gray-50));
}

.weak-count {
  color: var(--text-soft);
  font-size: var(--text-body);
}

.weak-percent {
  margin-left: auto;
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.weak-suggestion {
  margin: var(--space-3) 0 0;
  color: var(--text-muted);
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
}

.weak-action {
  margin-top: var(--space-3);
}

.accuracy-card,
.weak-card {
  min-height: 260px;
}

.weak-card {
  display: grid;
  align-content: start;
}

.trend-chart {
  --trend-gap: 8px;
  height: 190px;
  display: grid;
  grid-template-columns: repeat(var(--trend-count, 7), minmax(0, 1fr));
  align-items: end;
  gap: var(--trend-gap);
  margin-top: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, rgba(246, 248, 251, 0.72), rgba(255, 255, 255, 0.94) 58%),
    var(--surface);
  box-shadow: inset 0 -1px 0 rgba(17, 22, 32, 0.03);
}

.trend-period-7 {
  --trend-count: 7;
  --trend-gap: 12px;
}

.trend-period-30 {
  --trend-count: 30;
  --trend-gap: 5px;
}

.trend-period-all {
  --trend-count: 30;
  --trend-gap: 5px;
}

.trend-bar {
  position: relative;
  height: 100%;
  min-width: 0;
  display: grid;
  grid-template-rows: 22px minmax(0, 1fr) 18px;
  width: 100%;
  justify-items: center;
  gap: 6px;
}

.trend-value {
  grid-row: 1;
  color: var(--text-soft);
  font-size: var(--text-caption);
  font-weight: var(--weight-semibold);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.trend-fill {
  grid-row: 2;
  align-self: end;
  width: min(26px, 72%);
  min-height: 6px;
  border-radius: var(--radius-full) var(--radius-full) 4px 4px;
  background: linear-gradient(180deg, var(--primary), #6f8af2);
  transition: height var(--transition-slow);
}

.trend-bar.is-empty .trend-value {
  color: transparent;
}

.trend-bar.is-empty .trend-fill {
  width: min(24px, 70%);
  min-height: 4px;
  background: var(--gray-150);
  opacity: 0.65;
}

.trend-bar span {
  grid-row: 3;
  max-width: 100%;
  overflow: hidden;
  text-overflow: clip;
  color: var(--text-muted);
  font-size: 11px;
  transform: none;
  transform-origin: center;
  line-height: 1;
  white-space: nowrap;
}

.trend-bar span.muted {
  opacity: 0;
}

.trend-period-30 .trend-fill,
.trend-period-all .trend-fill {
  width: min(18px, 78%);
}

.trend-period-30 .trend-bar,
.trend-period-all .trend-bar {
  grid-template-rows: 18px minmax(0, 1fr) 16px;
}

.trend-period-30 .trend-value,
.trend-period-all .trend-value {
  font-size: 10px;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .stats-header {
    display: none;
  }

  .insight-banner {
    flex-direction: column;
    align-items: stretch;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .insight-banner .btn {
    width: 100%;
    margin-top: var(--space-2);
  }

  .insight-metrics {
    width: 100%;
    justify-content: space-between;
  }

  .metrics-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .analysis-grid {
    grid-template-columns: 1fr;
  }

  .accuracy-body {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 560px) {
  .insight-metrics {
    gap: var(--space-2);
  }

  .metrics-row {
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .metric-box {
    padding: var(--space-3);
    min-height: 72px;
  }

  .metric-box-num {
    font-size: var(--text-section-title);
  }

  .trend-chart {
    height: 156px;
    gap: 4px;
    padding: var(--space-3) var(--space-2) var(--space-2);
  }

  .trend-period-7 {
    --trend-gap: 8px;
  }

  .trend-period-30 .trend-bar,
  .trend-period-all .trend-bar {
    grid-template-rows: 18px minmax(0, 1fr) 0;
  }

  .trend-period-30 .trend-bar span,
  .trend-period-all .trend-bar span {
    display: none;
  }

  .trend-fill {
    width: min(18px, 72%);
  }

  .trend-value {
    font-size: 10px;
  }
}
</style>
