<script setup lang="ts">
import type { ExamRecord } from '@/types';
import { useExamStore } from '@/stores/exam';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { downloadJson, formatDateTime, today } from '@/services/utils';

const library = useLibraryStore();
const exam = useExamStore();
const ui = useUiStore();

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
          <strong>${index + 1}. ${question.question}</strong>
          <div>A. ${question.optionA}</div>
          <div>B. ${question.optionB}</div>
          <div>C. ${question.optionC}</div>
          <div>D. ${question.optionD}</div>
          <p>正确答案：${question.correctAnswer} | 你的答案：${question.userAnswer}</p>
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
    <div class="page-header">
      <div>
        <h1 class="page-title">考试记录</h1>
        <p class="page-subtitle">历次模拟考试成绩</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary" type="button" @click="exportHistory">导出记录</button>
        <button class="btn btn-danger" type="button" @click="clearHistory">清空记录</button>
      </div>
    </div>

    <div v-if="library.examHistory.length === 0" class="empty-state">
      <div class="empty-title">暂无考试记录</div>
      <div class="empty-desc">完成一次模拟答题后，记录将显示在这里。</div>
    </div>

    <div v-else class="history-list">
      <article v-for="record in library.examHistory" :key="record.id" class="history-item">
        <div class="history-score" :class="{ pass: record.score >= 60 }">
          <strong>{{ record.score }}</strong>
          <span>分</span>
        </div>
        <div class="history-main">
          <h3>{{ record.subjectName }}</h3>
          <p>{{ formatDateTime(record.date) }} · {{ record.correct }}/{{ record.totalQuestions }} 正确 · {{ record.duration }} 分钟</p>
        </div>
        <div class="history-actions">
          <button class="btn btn-sm btn-primary" type="button" @click="viewDetail(record)">查看详情</button>
          <button class="btn btn-sm btn-ghost" type="button" @click="exam.retake(record)">重做此卷</button>
          <button class="btn btn-sm btn-danger" type="button" @click="deleteRecord(record)">删除</button>
        </div>
      </article>
    </div>
  </section>
</template>
