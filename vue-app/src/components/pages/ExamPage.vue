<script setup lang="ts">
import { computed, ref } from 'vue';
import type { AnswerOption } from '@/types';
import { useExamStore } from '@/stores/exam';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';

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
</script>

<template>
  <section class="page exam-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">模拟答题</h1>
        <p class="page-subtitle">选择学科和参数，开始练习</p>
      </div>
    </div>

    <div v-if="!hasActiveExam && !exam.result" class="exam-setup">
      <div class="exam-setup-hero">
        <div>
          <span class="section-kicker">学习任务</span>
          <h2>创建练习任务</h2>
          <p>{{ selectedSubjectName }} · {{ setupCountText }} · {{ exam.setup.time }} 分钟</p>
        </div>
        <div class="setup-summary">
          <div><strong>{{ library.subjects.length }}</strong><span>学科</span></div>
          <div><strong>{{ setupQuestionCount }}</strong><span>可选题目</span></div>
          <div><strong>{{ library.wrongQuestions.length }}</strong><span>错题</span></div>
        </div>
      </div>

      <div class="setup-grid">
        <label class="setup-card">
          <span><i>题库</i>选择学科</span>
          <select v-model="exam.setup.subjectId" class="select-control">
            <option value="all">全部学科</option>
            <option v-for="subject in library.subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
          </select>
          <small>当前范围共 {{ setupQuestionCount }} 道题</small>
        </label>
        <label class="setup-card">
          <span><i>题量</i>题目数量</span>
          <select v-model="exam.setup.count" class="select-control">
            <option value="20">20题（快速练习）</option>
            <option value="50">50题（标准练习）</option>
            <option value="100">100题（全面练习）</option>
            <option value="all">全部题目</option>
          </select>
        </label>
        <label class="setup-card">
          <span><i>计时</i>考试时间</span>
          <select v-model.number="exam.setup.time" class="select-control">
            <option :value="30">30 分钟</option>
            <option :value="60">60 分钟</option>
            <option :value="90">90 分钟</option>
            <option :value="120">120 分钟</option>
          </select>
        </label>
      </div>
      <div class="smart-card">
        <label class="smart-option"><input v-model="exam.setup.wrongFirst" type="checkbox" /><span>优先错题</span></label>
        <label class="smart-option"><input v-model="exam.setup.weighted" type="checkbox" /><span>加权抽题</span></label>
        <label class="smart-option"><input v-model="exam.setup.tagged" type="checkbox" /><span>优先「需复习」标签</span></label>
        <label class="smart-option"><input v-model="exam.setup.favoritesOnly" type="checkbox" /><span>只练收藏</span></label>
      </div>
      <div class="setup-action-panel">
        <div>
          <strong>{{ setupCountText }}</strong>
          <span>{{ selectedSubjectName }} · {{ exam.setup.time }} 分钟</span>
        </div>
        <button class="btn btn-primary btn-start" type="button" @click="exam.startExam">开始练习</button>
      </div>
    </div>

    <div v-else-if="exam.result" class="result-panel">
      <div class="result-score" :class="{ pass: exam.result.score >= 60 }">{{ exam.result.score }}分</div>
      <h2>{{ exam.result.isWrongPractice ? '错题练习完成' : (exam.result.score >= 60 ? '恭喜通过！' : '继续加油！') }}</h2>
      <div class="result-details">
        <div><strong>{{ exam.result.correct }}/{{ exam.result.total }}</strong><span>正确题数</span></div>
        <div><strong>{{ exam.result.duration }}</strong><span>分钟用时</span></div>
        <div><strong>{{ exam.result.isWrongPractice ? exam.result.correctedCount : exam.result.wrongCount }}</strong><span>{{ exam.result.isWrongPractice ? '已掌握' : '错题数' }}</span></div>
      </div>
      <div class="result-actions">
        <button class="btn btn-primary" type="button" @click="exam.restart">返回设置</button>
        <button v-if="library.wrongQuestions.length" class="btn btn-warning" type="button" @click="exam.startWrongPractice()">练习错题</button>
        <button class="btn btn-ghost" type="button" @click="showHistory">查看记录</button>
      </div>
    </div>

    <div v-else-if="exam.currentExam && question" class="exam-live">
      <div class="exam-topbar">
        <div class="exam-progress">
          <span>{{ exam.currentExam.currentIndex + 1 }}</span>
          <small>/ {{ exam.currentExam.questions.length }}</small>
          <div class="progress-track"><div :style="{ width: `${exam.progressPercent}%` }" /></div>
        </div>
        <div class="exam-status-line">
          <span class="subject-tag">{{ exam.currentExam.subjectName }}</span>
          <strong v-if="!exam.currentExam.isWrongPractice" class="timer" :class="{ danger: (exam.currentExam.timeLeft || 0) <= 300 }">
            {{ exam.timeDisplay }}
          </strong>
        </div>
        <button class="btn btn-sm btn-secondary" type="button" @click="answerCardOpen = !answerCardOpen">答题卡</button>
      </div>

      <div v-if="answerCardOpen" class="answer-card">
        <button
          v-for="(_, index) in exam.currentExam.questions"
          :key="index"
          class="answer-card-item"
          :class="{ current: index === exam.currentExam.currentIndex, answered: Boolean(exam.currentExam.answers[exam.currentExam.questions[index].id]) }"
          type="button"
          @click="exam.jump(index); answerCardOpen = false"
        >
          {{ index + 1 }}
        </button>
      </div>

      <article class="question-card exam-question">
        <div class="q-header">
          <span class="q-index">第 {{ exam.currentExam.currentIndex + 1 }} 题</span>
          <button class="icon-btn" :class="{ active: library.isFavorited(question.id) }" type="button" @click="library.toggleFavorite(question.id)">★</button>
        </div>
        <h2 class="q-title">{{ question.question }}</h2>
        <div class="exam-options">
          <button
            v-for="option in ['A', 'B', 'C', 'D']"
            :key="option"
            class="exam-option"
            :class="{ selected: selectedAnswer === option }"
            type="button"
            @click="choose(option as AnswerOption)"
          >
            <strong>{{ option }}</strong>
            <span>{{ question[`option${option}` as keyof typeof question] }}</span>
          </button>
        </div>
      </article>

      <div class="exam-nav">
        <button class="btn btn-secondary" type="button" :disabled="exam.currentExam.currentIndex === 0" @click="exam.prev">← 上一题</button>
        <button class="btn btn-secondary" type="button" :disabled="exam.currentExam.currentIndex === exam.currentExam.questions.length - 1" @click="exam.next">下一题 →</button>
        <button class="btn btn-primary" type="button" @click="exam.submit">提交答卷</button>
      </div>
    </div>
  </section>
</template>
