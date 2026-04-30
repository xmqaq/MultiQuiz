<script setup lang="ts">
import { computed, ref } from 'vue';
import { useExamStore } from '@/stores/exam';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { formatDateTime, today } from '@/services/utils';

const library = useLibraryStore();
const exam = useExamStore();
const ui = useUiStore();
const subjectFilter = ref('all');

const wrongPool = computed(() => subjectFilter.value === 'all'
  ? library.wrongQuestions
  : library.wrongQuestions.filter(q => q.subjectId === subjectFilter.value));

const todayCount = computed(() =>
  library.wrongQuestions.filter(q => q.timestamp.startsWith(today())).length
);

function clearWrong() {
  if (library.wrongQuestions.length === 0) {
    ui.showToast('错题本已为空', 'info');
    return;
  }
  ui.showModal('清空错题', '确定清空所有错题？此操作不可恢复。', [
    { label: '清空错题', style: 'danger', action: () => {
      library.clearWrongQuestions();
      ui.showToast('错题本已清空', 'success');
    }},
    { label: '取消', style: 'ghost', action: () => {} }
  ]);
}
</script>

<template>
  <section class="page wrongbook-page">

    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">错题本</h1>
        <p class="page-subtitle">{{ library.wrongQuestions.length ? `共 ${library.wrongQuestions.length} 道错题待复习` : '暂无错题记录' }}</p>
      </div>
      <div class="header-actions">
        <button
          v-if="library.wrongQuestions.length"
          class="btn btn-primary"
          type="button"
          @click="exam.startWrongPractice(subjectFilter)"
        >练习错题</button>
        <button
          v-if="library.wrongQuestions.length"
          class="btn btn-ghost btn-sm"
          type="button"
          @click="clearWrong"
        >清空</button>
      </div>
    </div>

    <!-- Overview -->
    <div v-if="library.wrongQuestions.length" class="overview-grid">
      <div class="overview-card">
        <span class="metric-number">{{ library.wrongQuestions.length }}</span>
        <span class="metric-label">错题总数</span>
      </div>
      <div class="overview-card">
        <span class="metric-number">{{ todayCount }}</span>
        <span class="metric-label">今日新增</span>
      </div>
      <div class="overview-card">
        <span class="metric-number">{{ wrongPool.length }}</span>
        <span class="metric-label">当前筛选</span>
      </div>
      <div class="overview-card">
        <span class="metric-number">{{ library.subjects.filter(s => library.wrongQuestions.some(q => q.subjectId === s.id)).length }}</span>
        <span class="metric-label">涉及学科</span>
      </div>
    </div>

    <!-- Subject filter -->
    <div v-if="library.wrongQuestions.length" class="wrong-filter">
      <select v-model="subjectFilter" class="select-control">
        <option value="all">全部学科</option>
        <option v-for="subject in library.subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
      </select>
    </div>

    <!-- Empty -->
    <div v-if="library.wrongQuestions.length === 0" class="empty-state">
      <div class="empty-title">暂无错题</div>
      <div class="empty-desc">完成模拟答题后，答错的题目会自动记录在这里。保持练习，错题会越来越少。</div>
      <button class="btn btn-primary" type="button" @click="ui.switchTab('exam')">去练习</button>
    </div>
    <div v-else-if="wrongPool.length === 0" class="empty-state">
      <div class="empty-title">该学科暂无错题</div>
    </div>

    <!-- Wrong Questions List -->
    <div v-else class="wrong-list">
      <article v-for="(question, index) in wrongPool" :key="`${question.id}-${question.timestamp}`" class="card-content wrong-item">
        <!-- Header -->
        <div class="wrong-item-header">
          <div class="wrong-meta">
            <span class="wrong-num">#{{ index + 1 }}</span>
            <span class="subject-tag">{{ question.subjectName }}</span>
          </div>
          <span class="wrong-time">{{ formatDateTime(question.timestamp) }}</span>
        </div>

        <!-- Question -->
        <h3 class="wrong-title">{{ question.question }}</h3>

        <!-- Options with correct/wrong indicators -->
        <div class="option-grid">
          <div class="option-item" :class="{ 'correct-opt': question.answer === 'A', 'wrong-opt-item': question.userAnswer === 'A' && question.answer !== 'A' }"><span>A</span><p>{{ question.optionA }}</p></div>
          <div class="option-item" :class="{ 'correct-opt': question.answer === 'B', 'wrong-opt-item': question.userAnswer === 'B' && question.answer !== 'B' }"><span>B</span><p>{{ question.optionB }}</p></div>
          <div class="option-item" :class="{ 'correct-opt': question.answer === 'C', 'wrong-opt-item': question.userAnswer === 'C' && question.answer !== 'C' }"><span>C</span><p>{{ question.optionC }}</p></div>
          <div class="option-item" :class="{ 'correct-opt': question.answer === 'D', 'wrong-opt-item': question.userAnswer === 'D' && question.answer !== 'D' }"><span>D</span><p>{{ question.optionD }}</p></div>
        </div>

        <!-- Answer comparison -->
        <div class="answer-compare">
          <span class="answer-pair">
            <span>你的答案</span>
            <strong class="answer-badge wrong">{{ question.userAnswer }}</strong>
          </span>
          <span class="answer-arrow">→</span>
          <span class="answer-pair">
            <span>正确答案</span>
            <strong class="answer-badge correct">{{ question.answer }}</strong>
          </span>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.wrongbook-page {
  width: min(var(--content-reading), 100%);
}

.wrong-filter {
  display: flex;
  margin-bottom: var(--space-3);
}

.wrong-filter .select-control {
  width: auto;
  min-width: 160px;
}

.wrong-list {
  gap: var(--space-3);
}

.wrong-item {
  padding: var(--card-padding-compact);
  border-left-color: rgba(69, 94, 221, 0.55);
}

.wrong-meta {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.wrong-title {
  margin: var(--space-2) 0 var(--space-3);
  font-size: var(--text-card-title);
  font-weight: var(--weight-semibold);
  line-height: var(--leading-relaxed);
}

.option-item {
  min-height: 40px;
  padding: 7px var(--space-3);
}

.option-item span {
  width: 24px;
  height: 24px;
}

.answer-compare {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--gray-50);
  font-size: var(--text-body);
}

.answer-pair {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
}

.answer-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  font-size: var(--text-caption);
  font-weight: var(--weight-bold);
}

.answer-badge.wrong {
  background: var(--danger-light);
  color: var(--danger);
}

.answer-badge.correct {
  background: var(--success-light);
  color: var(--success);
}

.answer-arrow {
  color: var(--border-focus);
}
</style>
