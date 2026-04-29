<script setup lang="ts">
import { computed } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useStatsStore } from '@/stores/stats';

const library = useLibraryStore();
const stats = useStatsStore();
const maxTrend = computed(() => Math.max(1, ...stats.practiceTrend.map((item: { questions: number }) => item.questions)));
const hasPractice = computed(() => stats.practicedCount > 0);
const accuracyStyle = computed<Record<string, string>>(() => ({ '--accuracy': `${Math.max(stats.accuracyRate, 5)}%` }));
const bestSubject = computed(() => stats.subjectDistribution.reduce(
  (best: { name: string; count: number } | null, subject: { name: string; count: number }) =>
    !best || subject.count > best.count ? subject : best,
  null
));
</script>

<template>
  <section class="page stats-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">统计分析</h1>
        <p class="page-subtitle">你的学习数据概览</p>
      </div>
    </div>

    <div class="stats-hero">
      <div class="stats-hero-main">
        <span class="section-kicker">学习洞察</span>
        <h2>{{ hasPractice ? '你的练习表现' : '题库已经准备好了' }}</h2>
        <p>{{ hasPractice ? `累计完成 ${stats.practicedCount} 道题，当前正确率 ${stats.accuracyRate}%` : `已导入 ${library.subjects.length} 个学科、${stats.totalQuestions} 道题` }}</p>
        <div class="stats-hero-meta">
          <div><strong>{{ library.subjects.length }}</strong><span>学科</span></div>
          <div><strong>{{ bestSubject?.name || '暂无' }}</strong><span>题量最多</span></div>
          <div><strong>{{ stats.wrongCount }}</strong><span>待复习</span></div>
        </div>
      </div>
      <div class="accuracy-panel">
        <div class="accuracy-ring" :style="accuracyStyle">
          <span>{{ stats.accuracyRate }}%</span>
          <small>正确率</small>
        </div>
        <div class="accuracy-copy">
          <strong>{{ hasPractice ? '练习表现' : '尚未练习' }}</strong>
          <span>{{ hasPractice ? `${stats.practicedCount} 道题已计入统计` : '完成一次模拟答题后生成表现曲线' }}</span>
        </div>
      </div>
    </div>

    <div class="stats-overview">
      <div class="stat-card"><span>{{ stats.totalQuestions }}</span><small>题库规模</small></div>
      <div class="stat-card"><span>{{ stats.practicedCount }}</span><small>累计练习</small></div>
      <div class="stat-card"><span>{{ stats.accuracyRate }}%</span><small>当前正确率</small></div>
      <div class="stat-card"><span>{{ stats.wrongCount }}</span><small>待复习错题</small></div>
    </div>

    <div class="chart-card heatmap-card">
      <div class="chart-card-header">
        <div>
          <h3>学习热力图</h3>
          <span>最近 12 周练习量</span>
        </div>
        <div class="heatmap-legend">
          <span />
          <span />
          <span />
          <span />
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
    </div>

    <div class="chart-card">
      <div class="chart-card-header">
        <div>
          <h3>学科题量分布</h3>
          <span>{{ library.subjects.length }} 个学科</span>
        </div>
      </div>
      <div v-if="library.subjects.length === 0" class="empty-state compact">暂无数据</div>
      <div v-else class="dist-list">
        <div v-for="subject in stats.subjectDistribution" :key="subject.id" class="dist-row">
          <span>{{ subject.name }}</span>
          <div class="dist-track"><div :style="{ width: `${subject.percent}%` }" /></div>
          <strong>{{ subject.count }}</strong>
        </div>
      </div>
    </div>

    <div class="chart-card">
      <div class="chart-card-header">
        <div>
          <h3>练习趋势</h3>
          <span>{{ hasPractice ? '按练习记录汇总' : '暂无练习记录' }}</span>
        </div>
        <div class="period-tabs">
          <button :class="{ active: stats.period === '7' }" type="button" @click="stats.setPeriod('7')">近7天</button>
          <button :class="{ active: stats.period === '30' }" type="button" @click="stats.setPeriod('30')">近30天</button>
          <button :class="{ active: stats.period === 'all' }" type="button" @click="stats.setPeriod('all')">全部</button>
        </div>
      </div>
      <div v-if="!hasPractice" class="trend-empty">
        <strong>等待第一条练习记录</strong>
        <span>完成模拟答题后，这里会显示每日练习题量。</span>
      </div>
      <div v-else class="trend-chart">
        <div v-for="item in stats.practiceTrend" :key="item.date" class="trend-bar" :title="`${item.date}: ${item.questions} 题`">
          <div :style="{ height: `${Math.max(4, item.questions / maxTrend * 100)}%` }" />
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
