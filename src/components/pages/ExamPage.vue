<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import type { AnswerOption } from '@/types';
import { useExamStore } from '@/stores/exam';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import TabIcon from '@/components/common/TabIcon.vue';

const ANSWER_OPTIONS: AnswerOption[] = ['A', 'B', 'C', 'D'];
const KEY_TO_ANSWER: Record<string, AnswerOption> = {
  'a': 'A', 'b': 'B', 'c': 'C', 'd': 'D',
  '1': 'A', '2': 'B', '3': 'C', '4': 'D'
};

const exam = useExamStore();
const library = useLibraryStore();
const ui = useUiStore();
const answerCardOpen = ref(false);

const question = computed(() => exam.activeQuestion);
const selectedAnswer = computed(() => question.value ? exam.currentExam?.answers[question.value.id] : undefined);
const hasActiveExam = computed(() => Boolean(exam.currentExam && !exam.result));
const setupQuestionCount = computed(() => exam.subjectQuestionCount());
const selectedSubjectName = computed(() => {
  if (exam.setup.subjectId === 'all') return '全部学科';
  return library.subjects.find(subject => subject.id === exam.setup.subjectId)?.name || '当前学科';
});
const setupCountText = computed(() => {
  if (exam.setup.count === 'all') return `${setupQuestionCount.value} 题`;
  return `${Math.min(Number(exam.setup.count), setupQuestionCount.value)} 题`;
});

function choose(option: AnswerOption) {
  exam.chooseAnswer(option);
}

function showHistory() {
  exam.restart();
  ui.switchTab('history');
}

function getAnswerAtIndex(index: number) {
  return exam.currentExam?.answers[exam.currentExam?.questions[index]?.id ?? ''];
}

function handleExamKeydown(event: KeyboardEvent) {
  if (!hasActiveExam.value) return;
  const answer = KEY_TO_ANSWER[event.key.toLowerCase()];
  if (answer) {
    choose(answer);
    return;
  }
  if (event.key === 'ArrowLeft') {
    exam.prev();
  } else if (event.key === 'ArrowRight') {
    exam.next();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleExamKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleExamKeydown);
});
</script>

<template>
  <section class="page exam-page" :class="{ 'exam-page-setup': !hasActiveExam && !exam.result }">

    <!-- ====== SETUP MODE ====== -->
    <template v-if="!hasActiveExam && !exam.result">
      <div class="page-header">
        <div>
          <h1 class="page-title">模拟答题</h1>
          <p class="page-subtitle">{{ library.subjects.length ? '选择学科和参数，开始练习' : '请先导入题库' }}</p>
        </div>
      </div>

      <div v-if="library.subjects.length === 0" class="empty-state">
        <div class="empty-title">还没有题库</div>
        <div class="empty-desc">导入题库后即可开始练习</div>
        <button class="btn btn-primary" type="button" @click="ui.switchTab('import')">导入题库</button>
      </div>

      <div v-else class="exam-setup">
        <!-- Quick start cards -->
        <div class="quick-start-grid">
          <div class="card-content quick-start-card quick-start-all" @click="exam.setup.subjectId = 'all'; exam.setup.count = 'all'; exam.startExam()">
            <span class="quick-start-mark" aria-hidden="true"><TabIcon name="subjects" /></span>
            <strong>全部练习</strong>
            <p>所有学科 · {{ setupQuestionCount }} 题</p>
          </div>
          <div class="card-content quick-start-card quick-start-standard" @click="exam.setup.count = 50; exam.startExam()">
            <span class="quick-start-mark" aria-hidden="true"><TabIcon name="exam" /></span>
            <strong>标准练习</strong>
            <p>随机 50 题 · 60 分钟</p>
          </div>
          <div
            class="card-content quick-start-card quick-start-wrong"
            :class="{ disabled: !library.wrongQuestions.length }"
            :style="{ opacity: library.wrongQuestions.length ? 1 : 0.5, pointerEvents: library.wrongQuestions.length ? 'auto' : 'none' }"
            @click="if (library.wrongQuestions.length) { exam.startWrongPractice(); }"
          >
            <span class="quick-start-mark" aria-hidden="true"><TabIcon name="wrong" /></span>
            <strong>错题强化</strong>
            <p>{{ library.wrongQuestions.length ? `${library.wrongQuestions.length} 道错题` : '暂无错题' }}</p>
          </div>
        </div>

        <!-- Custom setup -->
        <div class="card-container custom-setup-card">
          <h2 class="section-title setup-title">
            <span class="setup-title-icon" aria-hidden="true"><TabIcon name="exam" /></span>
            自定义练习
          </h2>

          <div class="setup-grid">
            <label class="form-field">
              <span><TabIcon name="subjects" />选择学科</span>
              <select v-model="exam.setup.subjectId" class="select-control">
                <option value="all">全部学科</option>
                <option v-for="subject in library.subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
              </select>
            </label>
            <label class="form-field">
              <span><TabIcon name="browse" />题目数量</span>
              <select v-model="exam.setup.count" class="select-control">
                <option :value="20">20 题（快速）</option>
                <option :value="50">50 题（标准）</option>
                <option :value="100">100 题（全面）</option>
                <option value="all">全部（{{ setupQuestionCount }} 题）</option>
              </select>
            </label>
            <label class="form-field">
              <span><TabIcon name="history" />考试时间</span>
              <select v-model.number="exam.setup.time" class="select-control">
                <option :value="30">30 分钟</option>
                <option :value="60">60 分钟</option>
                <option :value="90">90 分钟</option>
                <option :value="120">120 分钟</option>
              </select>
            </label>
          </div>

          <div class="setup-toggles">
            <label class="smart-option"><input v-model="exam.setup.wrongFirst" type="checkbox" /><TabIcon name="wrong" /><span>优先错题</span></label>
            <label class="smart-option"><input v-model="exam.setup.weighted" type="checkbox" /><TabIcon name="stats" /><span>加权抽题</span></label>
            <label class="smart-option"><input v-model="exam.setup.tagged" type="checkbox" /><TabIcon name="browse" /><span>优先「需复习」标签</span></label>
            <label class="smart-option"><input v-model="exam.setup.favoritesOnly" type="checkbox" /><span class="favorite-icon" aria-hidden="true">★</span><span>只练收藏</span></label>
          </div>

          <div class="setup-footer">
            <div>
              <span class="setup-count">{{ setupCountText }}</span>
              <span class="setup-meta">{{ selectedSubjectName }} · {{ exam.setup.time }} 分钟</span>
            </div>
            <button class="btn btn-primary btn-lg" type="button" @click="exam.startExam">
              <TabIcon name="exam" />
              开始练习
            </button>
          </div>
        </div>
      </div>
    </template>

    <!-- ====== RESULT MODE ====== -->
    <div v-else-if="exam.result" class="card-content result-panel">
      <div class="result-score" :class="{ pass: exam.result.score >= 60 }">{{ exam.result.score }}<span class="result-score-unit">分</span></div>
      <h2 class="result-title">{{ exam.result.isWrongPractice ? '错题练习完成' : (exam.result.score >= 60 ? '恭喜通过！' : '继续加油！') }}</h2>
      <div class="result-details result-detail-grid">
        <div><strong>{{ exam.result.correct }}/{{ exam.result.total }}</strong><span>正确</span></div>
        <div><strong>{{ exam.result.duration }}</strong><span>分钟用时</span></div>
        <div><strong>{{ exam.result.isWrongPractice ? exam.result.correctedCount : exam.result.wrongCount }}</strong><span>{{ exam.result.isWrongPractice ? '已掌握' : '错题' }}</span></div>
      </div>
      <div class="result-actions">
        <button class="btn btn-primary" type="button" @click="exam.restart">返回</button>
        <button v-if="library.wrongQuestions.length" class="btn btn-warning" type="button" @click="exam.startWrongPractice()">错题强化</button>
        <button class="btn btn-ghost" type="button" @click="showHistory">查看记录</button>
      </div>
    </div>

    <!-- ====== LIVE EXAM MODE ====== -->
    <div v-else-if="exam.currentExam && question" class="exam-live">
      <!-- Top bar -->
      <div class="card-content exam-topbar">
        <div class="exam-progress">
          <span>{{ exam.currentExam.currentIndex + 1 }}</span>
          <small>/ {{ exam.currentExam.questions.length }}</small>
          <div class="progress-track"><div :style="{ width: `${exam.progressPercent}%` }" /></div>
        </div>
        <div class="exam-status-line">
          <span class="subject-tag">{{ exam.currentExam.subjectName }}</span>
          <strong v-if="!exam.currentExam.isWrongPractice" class="timer" :class="{ danger: (exam.currentExam.timeLeft || 0) <= 300 }" role="timer" aria-live="assertive">
            {{ exam.timeDisplay }}
          </strong>
        </div>
        <button class="btn btn-ghost btn-sm" type="button" @click="answerCardOpen = !answerCardOpen">答题卡</button>
      </div>

      <!-- Answer card -->
      <div v-if="answerCardOpen" class="card-content answer-card">
        <button
          v-for="(_, index) in exam.currentExam.questions"
          :key="index"
          class="answer-card-item"
          :class="{ current: index === exam.currentExam?.currentIndex, answered: Boolean(getAnswerAtIndex(index)) }"
          type="button"
          :aria-label="`第${index + 1}题${getAnswerAtIndex(index) ? '·已作答' : ''}`"
          @click="exam.jump(index); answerCardOpen = false"
        >{{ index + 1 }}</button>
      </div>

      <!-- Question -->
      <article class="card-content exam-question">
        <div class="q-header">
          <span class="q-index">第 {{ exam.currentExam.currentIndex + 1 }} 题</span>
          <button
            class="icon-btn"
            :class="{ active: library.isFavorited(question.id) }"
            type="button"
            :aria-label="library.isFavorited(question.id) ? '取消收藏' : '收藏'"
            @click="library.toggleFavorite(question.id)"
          >★</button>
        </div>
        <h2 class="q-title">{{ question.question }}</h2>
        <div class="exam-options">
          <button
            v-for="option in ANSWER_OPTIONS"
            :key="option"
            class="exam-option"
            :class="{ selected: selectedAnswer === option }"
            :aria-pressed="selectedAnswer === option ? 'true' : 'false'"
            :aria-label="`选项 ${option}: ${question[`option${option}` as keyof typeof question]}`"
            type="button"
            @click="choose(option)"
          >
            <strong>{{ option }}</strong>
            <span>{{ question[`option${option}` as keyof typeof question] }}</span>
          </button>
        </div>
      </article>

      <!-- Nav -->
      <div class="exam-nav">
        <button class="btn btn-secondary" type="button" :disabled="exam.currentExam.currentIndex === 0" @click="exam.prev">上一题</button>
        <button class="btn btn-secondary" type="button" :disabled="exam.currentExam.currentIndex === exam.currentExam.questions.length - 1" @click="exam.next">下一题</button>
        <button class="btn btn-primary" type="button" @click="exam.submit">提交答卷</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.exam-page {
  width: min(940px, 100%);
}

.exam-page-setup {
  width: min(var(--content-max-width), 100%);
}

.exam-setup {
  gap: var(--space-3);
}

.quick-start-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-3);
}

.quick-start-card {
  --quick-accent: var(--primary);
  --quick-bg: var(--primary-surface);
  position: relative;
  display: grid;
  gap: 6px;
  min-height: 108px;
  padding: var(--card-padding-compact);
  cursor: pointer;
  overflow: hidden;
}

.quick-start-card::after {
  content: "";
  position: absolute;
  inset: auto -24px -28px auto;
  width: 82px;
  height: 82px;
  border-radius: 50%;
  background: var(--quick-bg);
  opacity: 0.58;
  pointer-events: none;
}

.quick-start-standard {
  --quick-accent: var(--accent);
  --quick-bg: var(--teal-50);
}

.quick-start-wrong {
  --quick-accent: var(--highlight);
  --quick-bg: var(--amber-50);
}

.quick-start-card.disabled {
  cursor: not-allowed;
}

.quick-start-card strong {
  font-size: var(--text-card-title);
  font-weight: var(--weight-semibold);
}

.quick-start-card p {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.quick-start-mark {
  display: inline-grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: var(--radius-md);
  background: var(--quick-bg);
  color: var(--quick-accent);
}

.quick-start-mark :deep(.tab-icon-svg) {
  width: 18px;
  height: 18px;
}

.custom-setup-card {
  padding: var(--card-padding);
}

.setup-title {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
}

.setup-title-icon {
  display: inline-grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-md);
  color: var(--primary);
  background: var(--primary-surface);
}

.setup-title-icon :deep(.tab-icon-svg) {
  width: 16px;
  height: 16px;
}

.setup-grid .form-field {
  margin-bottom: 0;
}

.setup-grid .form-field > span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.setup-grid .form-field :deep(.tab-icon-svg) {
  width: 14px;
  height: 14px;
  color: var(--primary);
}

.setup-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-3);
}

.smart-option :deep(.tab-icon-svg) {
  width: 14px;
  height: 14px;
  color: var(--text-muted);
}

.smart-option:has(input:checked) :deep(.tab-icon-svg) {
  color: var(--primary);
}

.favorite-icon {
  color: var(--highlight);
  font-size: 14px;
  line-height: 1;
}

.setup-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-top: var(--space-4);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border-soft);
}

.setup-count {
  font-size: var(--text-card-title);
  font-weight: var(--weight-bold);
}

.setup-meta {
  margin-left: var(--space-2);
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.setup-footer .btn :deep(.tab-icon-svg) {
  width: 16px;
  height: 16px;
}

.exam-live {
  width: min(var(--content-narrow), 100%);
}

.exam-question {
  padding: 22px;
}

.exam-question .q-title {
  margin: var(--space-3) 0 var(--space-4);
}

.exam-option {
  min-height: 48px;
}

.result-score-unit {
  font-size: 24px;
  font-weight: var(--weight-medium);
}

.result-title {
  margin: 0;
  font-size: var(--text-section-title);
  font-weight: var(--weight-bold);
}

.result-detail-grid {
  width: 100%;
  max-width: 480px;
}

@media (max-width: 760px) {
  .quick-start-grid {
    grid-template-columns: 1fr;
  }

  .setup-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .setup-footer .btn {
    width: 100%;
  }
}
</style>
