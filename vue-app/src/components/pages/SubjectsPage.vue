<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Subject } from '@/types';
import { useExamStore } from '@/stores/exam';
import { useBrowseStore } from '@/stores/browse';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { formatDateTime } from '@/services/utils';

const library = useLibraryStore();
const browse = useBrowseStore();
const ui = useUiStore();
const exam = useExamStore();
const restoreInput = ref<HTMLInputElement | null>(null);

const totalQuestions = computed(() => library.totalQuestions);

function openRestoreFile() {
  restoreInput.value?.click();
}

async function restoreConfig(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  ui.showModal('导入备份配置', '导入后将覆盖当前全部题库、错题和练习记录。', [
    { label: '确认导入', style: 'danger', action: async () => {
      try {
        await library.restoreBackupFile(file);
      } catch (error) {
        ui.showToast(error instanceof Error ? error.message : '备份文件解析失败', 'error');
      } finally {
        input.value = '';
      }
    }},
    { label: '取消', style: 'ghost', action: () => { input.value = ''; } }
  ]);
}

function showSubjectActions() {
  ui.showModal('题库管理', `当前共有 ${library.subjects.length} 个学科、${totalQuestions.value} 道题。`, [
    { label: '导出完整备份', action: () => library.exportAllBackup() },
    { label: '题库去重', style: 'secondary', action: () => library.deduplicateLibrary() },
    { label: '清空全部题库', style: 'danger', action: () => confirmClearAll() },
    { label: '取消', style: 'ghost', action: () => {} }
  ]);
}

function confirmClearAll() {
  ui.showModal('清空全部题库', '这会删除所有题库、错题、历史记录、标签和收藏。', [
    { label: '确认清空', style: 'danger', action: () => {
      library.clearLibrary();
      ui.showToast('全部题库及关联数据已清空', 'success');
    }},
    { label: '取消', style: 'ghost', action: () => {} }
  ]);
}

function manageSubject(subjectId: string) {
  const subject = library.subjects.find(item => item.id === subjectId);
  if (!subject) return;
  ui.showModal(`管理「${subject.name}」`, `共 ${subject.questions.length} 道题。`, [
    { label: '开始练习', action: () => quickExam(subjectId) },
    { label: '浏览题目', style: 'secondary', action: () => browseSubject(subjectId) },
    { label: '导出题库', style: 'secondary', action: () => library.exportSubject(subjectId) },
    { label: '编辑题库名', style: 'secondary', action: () => renameSubject(subjectId) },
    { label: '删除题库', style: 'danger', action: () => deleteSubject(subjectId) },
    { label: '取消', style: 'ghost', action: () => {} }
  ]);
}

function renameSubject(subjectId: string) {
  const subject = library.subjects.find(item => item.id === subjectId);
  const next = window.prompt('请输入新的题库名称', subject?.name || '');
  if (!next) return;
  library.renameSubject(subjectId, next);
  ui.showToast('题库名称已更新', 'success');
}

function deleteSubject(subjectId: string) {
  const subject = library.subjects.find(item => item.id === subjectId);
  ui.showModal('删除题库', `确定删除「${subject?.name || ''}」及其关联错题、记录、标签和收藏？`, [
    { label: '删除', style: 'danger', action: () => library.deleteSubject(subjectId) },
    { label: '取消', style: 'ghost', action: () => {} }
  ]);
}

function quickExam(subjectId: string) {
  exam.setup.subjectId = subjectId;
  exam.startExam();
  ui.switchTab('exam');
}

function browseSubject(subjectId: string) {
  browse.subjectFilter = subjectId;
  ui.switchTab('browse');
}

function subjectWrongCount(subjectId: string) {
  return library.wrongQuestions.filter(question => question.subjectId === subjectId).length;
}

function subjectFavoriteCount(subject: Subject) {
  return subject.questions.filter(question => library.isFavorited(question.id)).length;
}

function subjectShare(subject: Subject) {
  if (totalQuestions.value === 0) return 0;
  return Math.max(6, Math.round(subject.questions.length / totalQuestions.value * 100));
}
</script>

<template>
  <section class="page subjects-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">题库中心</h1>
        <p class="page-subtitle">管理你的所有学科题库</p>
      </div>
      <div class="header-actions">
        <input ref="restoreInput" type="file" accept=".json" hidden @change="restoreConfig" />
        <button class="btn btn-secondary" type="button" @click="openRestoreFile">导入配置</button>
        <button class="btn btn-secondary" type="button" @click="showSubjectActions">管理操作</button>
      </div>
    </div>

    <div class="learning-summary quick-metrics">
      <div class="metric-card">
        <span>{{ library.subjects.length }}</span>
        <small>学科</small>
      </div>
      <div class="metric-card">
        <span>{{ totalQuestions }}</span>
        <small>题目</small>
      </div>
      <div class="metric-card">
        <span>{{ library.wrongQuestions.length }}</span>
        <small>错题</small>
      </div>
      <div class="metric-card">
        <span>{{ library.examHistory.length }}</span>
        <small>记录</small>
      </div>
    </div>

    <div v-if="library.subjects.length === 0" class="empty-state">
      <div class="empty-title">还没有题库</div>
      <div class="empty-desc">点击「导入题库」开始添加第一个学科题库，或通过「导入配置」恢复已有数据。</div>
      <button class="btn btn-primary" type="button" @click="ui.switchTab('import')">导入题库</button>
    </div>

    <div v-else class="subject-grid">
      <article v-for="subject in library.subjects" :key="subject.id" class="subject-card course-card">
        <div class="subject-card-top">
          <div>
            <span class="section-kicker">课程题库</span>
            <h3>{{ subject.name }}</h3>
            <p>最近维护：{{ formatDateTime(new Date().toISOString()).slice(0, 10) }}</p>
          </div>
          <button class="icon-btn" type="button" @click="manageSubject(subject.id)">设置</button>
        </div>
        <div class="course-progress">
          <div>
            <span>题库占比</span>
            <strong>{{ subjectShare(subject) }}%</strong>
          </div>
          <i><b :style="{ width: `${subjectShare(subject)}%` }" /></i>
        </div>
        <div class="subject-stats">
          <div><strong>{{ subject.questions.length }}</strong><span>题目</span></div>
          <div><strong>{{ subjectWrongCount(subject.id) }}</strong><span>错题</span></div>
          <div><strong>{{ subjectFavoriteCount(subject) }}</strong><span>收藏</span></div>
        </div>
        <div class="subject-actions">
          <button class="btn btn-primary btn-sm" type="button" @click="quickExam(subject.id)">开始练习</button>
          <button class="btn btn-ghost btn-sm" type="button" @click="browseSubject(subject.id)">浏览题目</button>
        </div>
      </article>
    </div>
  </section>
</template>
