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
        <span class="metric-icon" aria-hidden="true"><TabIcon name="subjects" /></span>
        <span class="metric-box-num">{{ stats.totalQuestions }}</span>
        <span class="metric-box-label">题库总量</span>
        <span class="metric-box-hint">{{ library.subjects.length }} 个学科</span>
      </div>
      <div class="metric-box metric-box-practice">
        <span class="metric-icon" aria-hidden="true"><TabIcon name="exam" /></span>
        <span class="metric-box-num">{{ stats.practicedCount }}</span>
        <span class="metric-box-label">累计练习</span>
        <span class="metric-box-hint">{{ hasPractice ? '道题已练习' : '等待开始' }}</span>
      </div>
      <div class="metric-box metric-box-accuracy">
        <span class="metric-icon" aria-hidden="true"><TabIcon name="stats" /></span>
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
      <div v-else class="trend-chart" :class="{ 'trend-chart-week': stats.period === '7' }">
        <div
          v-for="item in stats.practiceTrend"
          :key="item.date"
          class="trend-bar"
          :class="{ 'is-empty': item.questions === 0 }"
          :title="`${item.date}: ${item.questions} 题`"
        >
          <strong v-if="stats.period === '7'" class="trend-value">{{ item.questions }}</strong>
          <div class="trend-fill" :style="{ height: `${Math.max(4, item.questions / maxTrend * 100)}%` }" />
          <span>{{ item.label }}</span>
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
  gap: 3px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-soft);
  background: var(--surface);
  min-height: 78px;
  align-content: center;
}

.metric-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  color: var(--primary);
  background: var(--primary-surface);
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
  font-size: var(--text-metric);
  font-weight: var(--weight-extrabold);
  color: var(--text);
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.metric-box-num.text-success { color: var(--success); }
.metric-box-num.text-warn { color: var(--danger); }

.metric-box-label {
  font-size: var(--text-body);
  font-weight: var(--weight-medium);
  color: var(--text-soft);
}

.metric-box-hint {
  font-size: var(--text-caption);
  color: var(--text-muted);
}

/* ── Analysis Grid ── */
.analysis-grid {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  gap: var(--space-4);
  align-items: start;
}

.analysis-left,
.analysis-right {
  display: grid;
  gap: var(--space-4);
  align-content: start;
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

.heatmap-note {
  margin: var(--space-3) 0 0;
  color: var(--text-muted);
  font-size: var(--text-caption);
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

.trend-chart.trend-chart-week {
  width: min(680px, 100%);
  height: 170px;
  grid-template-columns: repeat(7, minmax(48px, 1fr));
  justify-content: center;
  justify-items: center;
  gap: var(--space-2);
  margin: var(--space-2) auto 0;
  padding: var(--space-3) var(--space-4) var(--space-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-lg);
  background:
    linear-gradient(180deg, rgba(246, 248, 251, 0.72), rgba(255, 255, 255, 0.94)),
    var(--surface);
}

.trend-chart-week .trend-bar {
  width: 100%;
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  gap: 6px;
}

.trend-chart-week .trend-value {
  color: var(--text-soft);
  font-size: var(--text-caption);
  font-weight: var(--weight-semibold);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.trend-chart-week .trend-fill {
  width: 24px;
  min-height: 6px;
  border-radius: var(--radius-full) var(--radius-full) 4px 4px;
  background: linear-gradient(180deg, var(--primary), #6f8af2);
}

.trend-chart-week .trend-bar.is-empty .trend-fill {
  min-height: 4px;
  background: var(--gray-150);
}

.trend-chart-week .trend-bar span {
  font-size: 11px;
  transform: none;
  transform-origin: center;
  line-height: 1;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .stats-header {
    flex-direction: column;
  }

  .insight-banner {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
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
    min-height: 76px;
  }

  .metric-box-num {
    font-size: var(--text-section-title);
  }

  .trend-chart.trend-chart-week {
    height: 146px;
    grid-template-columns: repeat(7, minmax(30px, 1fr));
    gap: var(--space-2);
    padding-inline: var(--space-2);
  }

  .trend-chart-week .trend-fill {
    width: 18px;
  }

  .trend-chart-week .trend-value {
    font-size: 10px;
  }
}
</style>
