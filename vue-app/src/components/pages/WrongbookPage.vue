<script setup lang="ts">
import { computed, ref } from 'vue';
import { useExamStore } from '@/stores/exam';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { formatDateTime } from '@/services/utils';

const library = useLibraryStore();
const exam = useExamStore();
const ui = useUiStore();
const subjectFilter = ref('all');

const wrongPool = computed(() => subjectFilter.value === 'all'
  ? library.wrongQuestions
  : library.wrongQuestions.filter(question => question.subjectId === subjectFilter.value));

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
    <div class="page-header">
      <div>
        <h1 class="page-title">错题本</h1>
        <p class="page-subtitle">共 {{ library.wrongQuestions.length }} 道错题</p>
      </div>
      <div class="header-actions">
        <select v-model="subjectFilter" class="select-control">
          <option value="all">全部学科</option>
          <option v-for="subject in library.subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
        </select>
        <button class="btn btn-primary" type="button" @click="exam.startWrongPractice(subjectFilter)">错题练习</button>
        <button class="btn btn-danger" type="button" @click="clearWrong">清空错题</button>
      </div>
    </div>

    <div v-if="library.wrongQuestions.length === 0" class="empty-state">
      <div class="empty-title">暂无错题</div>
      <div class="empty-desc">完成模拟答题后，错题会自动记录在这里。</div>
    </div>
    <div v-else-if="wrongPool.length === 0" class="empty-state">
      <div class="empty-title">该学科暂无错题</div>
    </div>
    <div v-else class="wrong-list">
      <article v-for="(question, index) in wrongPool" :key="`${question.id}-${question.timestamp}`" class="wrong-item">
        <div class="wrong-item-header">
          <span class="wrong-num">{{ index + 1 }}</span>
          <span class="subject-tag">{{ question.subjectName }}</span>
          <span class="wrong-time">{{ formatDateTime(question.timestamp) }}</span>
        </div>
        <h3>{{ question.question }}</h3>
        <div class="option-grid">
          <div class="option-item" :class="{ 'correct-opt': question.answer === 'A', 'wrong-opt-item': question.userAnswer === 'A' && question.answer !== 'A' }"><span>A</span><p>{{ question.optionA }}</p></div>
          <div class="option-item" :class="{ 'correct-opt': question.answer === 'B', 'wrong-opt-item': question.userAnswer === 'B' && question.answer !== 'B' }"><span>B</span><p>{{ question.optionB }}</p></div>
          <div class="option-item" :class="{ 'correct-opt': question.answer === 'C', 'wrong-opt-item': question.userAnswer === 'C' && question.answer !== 'C' }"><span>C</span><p>{{ question.optionC }}</p></div>
          <div class="option-item" :class="{ 'correct-opt': question.answer === 'D', 'wrong-opt-item': question.userAnswer === 'D' && question.answer !== 'D' }"><span>D</span><p>{{ question.optionD }}</p></div>
        </div>
        <div class="answer-row">
          <span>你的答案：{{ question.userAnswer }}</span>
          <strong>正确答案：{{ question.answer }}</strong>
        </div>
      </article>
    </div>
  </section>
</template>
