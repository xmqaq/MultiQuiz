<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Subject } from '@/types';
import { useExamStore } from '@/stores/exam';
import { useBrowseStore } from '@/stores/browse';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { formatDateTime } from '@/services/utils';
import TabIcon from '@/components/common/TabIcon.vue';

const library = useLibraryStore();
const browse = useBrowseStore();
const ui = useUiStore();
const exam = useExamStore();
const restoreInput = ref<HTMLInputElement | null>(null);
const subjectMenuOpen = ref('');

const totalQuestions = computed(() => library.totalQuestions);

function lastPracticeDate(subjectId: string): string {
  const entry = library.practiceLog.find(log => log.subjectId === subjectId);
  if (!entry) return '暂无';
  return formatDateTime(entry.date).slice(0, 10);
}

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

function showManageMenu() {
  const html = `
    <p class="manage-summary">当前共有 ${library.subjects.length} 个学科、${totalQuestions.value} 道题。</p>
  `;
  ui.showHtmlModal('题库管理', html, [
    { label: '导出备份', style: 'secondary', description: '保存当前题库和练习数据', action: () => library.exportAllBackup() },
    { label: '题库去重', style: 'secondary', description: '合并重复题目', action: () => library.deduplicateLibrary() },
    { label: '清空题库', style: 'danger', description: '清空后将删除所有题库、错题、历史记录、标签和收藏。', action: () => confirmClearAll() },
    { label: '取消', style: 'ghost', action: () => {} }
  ], false);
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

function toggleSubjectMenu(subjectId: string) {
  subjectMenuOpen.value = subjectMenuOpen.value === subjectId ? '' : subjectId;
}

function manageSubject(subjectId: string, action: string) {
  const subject = library.subjects.find(item => item.id === subjectId);
  if (!subject) return;
  subjectMenuOpen.value = '';

  switch (action) {
    case 'exam':
      exam.setup.subjectId = subjectId;
      exam.startExam();
      ui.switchTab('exam');
      break;
    case 'browse':
      browse.subjectFilter = subjectId;
      ui.switchTab('browse');
      break;
    case 'export':
      library.exportSubject(subjectId);
      break;
    case 'rename': {
      const next = window.prompt('请输入新的题库名称', subject.name);
      if (next) {
        library.renameSubject(subjectId, next);
        ui.showToast('题库名称已更新', 'success');
      }
      break;
    }
    case 'delete':
      ui.showModal('删除题库', `确定删除「${subject.name}」及其关联错题、记录、标签和收藏？`, [
        { label: '删除', style: 'danger', action: () => library.deleteSubject(subjectId) },
        { label: '取消', style: 'ghost', action: () => {} }
      ]);
      break;
  }
}

function subjectWrongCount(subjectId: string) {
  return library.wrongQuestions.filter(q => q.subjectId === subjectId).length;
}

function subjectFavoriteCount(subject: Subject) {
  return subject.questions.filter(q => library.isFavorited(q.id)).length;
}

function quickExam(subjectId: string) {
  exam.setup.subjectId = subjectId;
  exam.startExam();
  ui.switchTab('exam');
}

function startWrongPractice() {
  if (library.wrongQuestions.length === 0) {
    ui.showToast('暂无错题', 'info');
    return;
  }
  exam.startWrongPractice();
  ui.switchTab('exam');
}
</script>

<template>
  <section class="page subjects-page">

    <!-- Page Header -->
    <div class="page-header">
      <div>
        <h1 class="page-title">题库中心</h1>
        <p class="page-subtitle">{{ library.subjects.length ? `${library.subjects.length} 个学科 · ${totalQuestions} 道题` : '导入题库开始学习' }}</p>
      </div>
      <div class="header-actions">
        <input ref="restoreInput" type="file" accept=".json" hidden @change="restoreConfig" />
        <button class="btn btn-ghost btn-sm" type="button" @click="openRestoreFile">导入配置</button>
        <button class="btn btn-primary btn-sm" type="button" @click="ui.switchTab('import')">导入题库</button>
        <button v-if="library.subjects.length" class="btn btn-ghost btn-sm" type="button" @click="showManageMenu">管理</button>
      </div>
    </div>

    <!-- Quick Overview -->
    <div v-if="library.subjects.length" class="overview-grid">
      <div class="overview-card overview-card-subjects">
        <span class="overview-icon" aria-hidden="true"><TabIcon name="subjects" /></span>
        <span class="metric-number">{{ library.subjects.length }}</span>
        <span class="metric-label">学科</span>
      </div>
      <div class="overview-card overview-card-questions">
        <span class="overview-icon" aria-hidden="true"><TabIcon name="browse" /></span>
        <span class="metric-number">{{ totalQuestions }}</span>
        <span class="metric-label">题目总量</span>
      </div>
      <div class="overview-card overview-card-wrong">
        <span class="overview-icon" aria-hidden="true"><TabIcon name="wrong" /></span>
        <span class="metric-number">{{ library.wrongQuestions.length }}</span>
        <span class="metric-label">待复习错题</span>
      </div>
      <div class="overview-card overview-card-history">
        <span class="overview-icon" aria-hidden="true"><TabIcon name="history" /></span>
        <span class="metric-number">{{ library.examHistory.length }}</span>
        <span class="metric-label">练习记录</span>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="library.subjects.length === 0" class="empty-state">
      <div class="empty-title">开始你的学习之旅</div>
      <div class="empty-desc">导入题库文件开始练习，支持 Excel 和 JSON 格式。已有备份也可以通过「导入配置」恢复。</div>
      <button class="btn btn-primary btn-lg" type="button" @click="ui.switchTab('import')">导入第一个题库</button>
    </div>

    <!-- Continue Learning (quick actions) -->
    <div v-if="library.subjects.length" class="card-container quick-practice">
      <div class="quick-practice-copy">
        <h2 class="section-title">快速练习</h2>
        <p>从全量题库或错题继续。</p>
      </div>
      <div class="quick-practice-actions">
        <button class="btn btn-primary" type="button" @click="ui.switchTab('exam')">
          <TabIcon name="exam" />
          模拟答题
        </button>
        <button v-if="library.wrongQuestions.length" class="btn btn-secondary" type="button" @click="startWrongPractice">
          <TabIcon name="wrong" />
          错题强化
        </button>
      </div>
    </div>

    <!-- Subject Cards -->
    <div v-if="library.subjects.length">
      <h2 class="section-title">题库</h2>
      <div class="subject-grid">
        <article
          v-for="(subject, index) in library.subjects"
          :key="subject.id"
          class="card-content course-card"
          :class="`course-accent-${index % 4}`"
        >
          <!-- Header -->
          <div class="course-card-header">
            <div class="course-title-row">
              <span class="course-icon" aria-hidden="true"><TabIcon name="subjects" /></span>
              <div>
                <h3 class="card-title">{{ subject.name }}</h3>
                <p>最近练习：{{ lastPracticeDate(subject.id) }}</p>
              </div>
            </div>
            <div class="subject-menu-wrap">
              <button class="icon-btn" type="button" @click="toggleSubjectMenu(subject.id)">···</button>
              <div v-if="subjectMenuOpen === subject.id" class="subject-menu">
                <button class="btn btn-ghost btn-sm btn-block subject-menu-item" type="button" @click="manageSubject(subject.id, 'exam')">开始练习</button>
                <button class="btn btn-ghost btn-sm btn-block subject-menu-item" type="button" @click="manageSubject(subject.id, 'browse')">浏览题目</button>
                <button class="btn btn-ghost btn-sm btn-block subject-menu-item" type="button" @click="manageSubject(subject.id, 'export')">导出题库</button>
                <button class="btn btn-ghost btn-sm btn-block subject-menu-item" type="button" @click="manageSubject(subject.id, 'rename')">重命名</button>
                <button class="btn btn-ghost btn-sm btn-block subject-menu-item danger" type="button" @click="manageSubject(subject.id, 'delete')">删除</button>
              </div>
            </div>
          </div>

          <!-- Progress -->
          <div class="course-progress">
            <div class="course-progress-label">
              <span>题库占比</span>
              <span>{{ Math.max(4, Math.round(subject.questions.length / Math.max(1, totalQuestions) * 100)) }}%</span>
            </div>
            <div class="course-progress-track">
              <span class="course-progress-fill" :style="{ width: `${Math.max(4, Math.round(subject.questions.length / Math.max(1, totalQuestions) * 100))}%` }" />
            </div>
          </div>

          <!-- Stats -->
          <div class="course-stats">
            <div class="course-stat"><strong>{{ subject.questions.length }}</strong><span>题目</span></div>
            <div class="course-stat"><strong>{{ subjectWrongCount(subject.id) }}</strong><span>错题</span></div>
            <div class="course-stat"><strong>{{ subjectFavoriteCount(subject) }}</strong><span>收藏</span></div>
          </div>

          <!-- Actions -->
          <div class="course-card-footer">
            <button class="btn btn-primary btn-sm" type="button" @click="quickExam(subject.id)">
              <TabIcon name="exam" />
              练习
            </button>
            <button class="btn btn-secondary btn-sm" type="button" @click="manageSubject(subject.id, 'browse')">
              <TabIcon name="browse" />
              浏览
            </button>
          </div>
        </article>
      </div>
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

.overview-card-subjects .overview-icon {
  color: var(--primary);
  background: var(--primary-surface);
}

.overview-card-questions .overview-icon {
  color: var(--accent);
  background: var(--teal-50);
}

.overview-card-wrong .overview-icon {
  color: var(--highlight);
  background: var(--highlight-light);
}

.overview-card-history .overview-icon {
  color: var(--success);
  background: var(--success-light);
}

.quick-practice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--section-gap);
  padding: var(--card-padding-compact);
}

.quick-practice-copy {
  min-width: 0;
}

.quick-practice-copy .section-title {
  margin-bottom: 2px;
}

.quick-practice-copy p {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.quick-practice-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}

.quick-practice-actions .btn {
  min-height: 40px;
  min-width: 132px;
  padding: 8px 16px;
  border-radius: var(--radius-lg);
  font-size: var(--text-body);
  font-weight: var(--weight-semibold);
}

.quick-practice-actions .btn-secondary {
  color: var(--text);
  background: var(--surface);
}

.quick-practice-actions :deep(.tab-icon-svg),
.course-card-footer :deep(.tab-icon-svg) {
  width: 15px;
  height: 15px;
}

.course-card {
  --course-accent: var(--primary);
  --course-accent-bg: var(--primary-surface);
  gap: var(--space-3);
  min-height: auto;
  padding: var(--card-padding-compact);
}

.course-accent-1 {
  --course-accent: var(--accent);
  --course-accent-bg: var(--teal-50);
}

.course-accent-2 {
  --course-accent: var(--highlight);
  --course-accent-bg: var(--amber-50);
}

.course-accent-3 {
  --course-accent: var(--success);
  --course-accent-bg: var(--green-50);
}

.course-card-header {
  min-height: 34px;
}

.course-title-row {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  min-width: 0;
}

.course-icon {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: var(--radius-md);
  color: var(--course-accent);
  background: var(--course-accent-bg);
  flex-shrink: 0;
}

.course-icon :deep(.tab-icon-svg) {
  width: 16px;
  height: 16px;
}

.course-card .course-progress-fill {
  background: var(--course-accent);
}

.course-stats {
  margin-top: 2px;
}

.course-stat {
  padding: 7px var(--space-2);
}

.course-card-footer .btn {
  min-height: 32px;
}

.subject-menu-wrap {
  position: relative;
}

.subject-menu {
  position: absolute;
  right: 0;
  top: calc(100% + 4px);
  z-index: 10;
  display: grid;
  min-width: 132px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  box-shadow: var(--shadow-raised);
}

.subject-menu-item {
  justify-content: flex-start;
}

.subject-menu-item.danger {
  color: var(--danger);
}

@media (max-width: 640px) {
  .quick-practice {
    align-items: stretch;
    flex-direction: column;
  }

  .quick-practice-actions {
    justify-content: stretch;
  }

  .quick-practice-actions .btn {
    flex: 1;
  }
}
</style>
