<script setup lang="ts">
import { ref } from 'vue';
import { useBrowseStore } from '@/stores/browse';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';
import { questionIdKey } from '@/services/utils';

const browse = useBrowseStore();
const library = useLibraryStore();
const ui = useUiStore();
const tagEditorFor = ref('');

function showExportActions() {
  ui.showModal('浏览页操作', `当前范围共 ${browse.filteredQuestions.length} 道题。`, [
    { label: '导出 JSON', action: () => library.exportCurrentQuestions(browse.subjectFilter, 'json') },
    { label: '导出文本', style: 'secondary', action: () => library.exportCurrentQuestions(browse.subjectFilter, 'text') },
    { label: '打印 / PDF', style: 'secondary', action: () => library.exportCurrentQuestions(browse.subjectFilter, 'print') },
    { label: '取消', style: 'ghost', action: () => {} }
  ]);
}

function addCustomTag(questionId: string) {
  const tag = window.prompt('输入新标签');
  if (!tag) return;
  library.addTag(questionId, tag);
}
</script>

<template>
  <section class="page browse-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">题目浏览</h1>
        <p class="page-subtitle">{{ browse.summary }} · {{ browse.filteredQuestions.length }} 道题</p>
      </div>
      <div class="header-actions">
        <button class="btn btn-secondary mobile-filter-toggle" type="button" @click="ui.mobileBrowseFiltersOpen = !ui.mobileBrowseFiltersOpen">
          {{ ui.mobileBrowseFiltersOpen ? '收起筛选' : '筛选' }}
        </button>
        <button class="btn btn-ghost" type="button" @click="browse.toggleAnswerMode">
          {{ browse.answerMode === 'hide' ? '显示答案' : '隐藏答案' }}
        </button>
        <button class="btn btn-ghost" type="button" @click="showExportActions">导出</button>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="card-container browse-toolbar">
      <div class="browse-toolbar-head">
        <div>
          <strong>筛选条件</strong>
          <span>{{ browse.filteredQuestions.length }} / {{ library.totalQuestions }} 道题</span>
        </div>
      </div>
      <div class="filter-grid" :class="{ 'filters-open': ui.mobileBrowseFiltersOpen }">
        <label>
          <span>学科</span>
          <select v-model="browse.subjectFilter" class="select-control">
            <option value="all">全部学科</option>
            <option v-for="subject in library.subjects" :key="subject.id" :value="subject.id">{{ subject.name }}</option>
          </select>
        </label>
        <label>
          <span>标签</span>
          <select v-model="browse.tagFilter" class="select-control">
            <option value="all">全部标签</option>
            <option value="untagged">无标签</option>
            <option v-for="tag in browse.availableTags" :key="tag" :value="tag">{{ tag }}</option>
          </select>
        </label>
        <label>
          <span>收藏</span>
          <select v-model="browse.favoriteFilter" class="select-control">
            <option value="all">全部</option>
            <option value="favorited">仅收藏</option>
            <option value="unfavorited">未收藏</option>
          </select>
        </label>
        <label>
          <span>搜索</span>
          <input v-model="browse.search" class="form-input" type="search" placeholder="搜索题干或选项..." />
        </label>
      </div>
    </div>

    <!-- Empty -->
    <div v-if="browse.filteredQuestions.length === 0" class="empty-state">
      <div class="empty-title">{{ library.totalQuestions === 0 ? '请先导入题库' : '没有匹配题目' }}</div>
      <div v-if="library.totalQuestions === 0" class="empty-desc">在「导入题库」上传文件后，题目将在这里显示。</div>
    </div>

    <!-- Question List -->
    <div v-else class="questions-list">
      <article v-for="(question, index) in browse.filteredQuestions" :key="question.id" class="card-content question-card">

        <!-- Zone 1: Header — number, subject tag, actions -->
        <div class="q-header">
          <div class="q-meta">
            <span class="q-index">#{{ index + 1 }}</span>
            <span class="subject-tag">{{ question._subjectName }}</span>
          </div>
          <div class="q-actions">
            <button
              class="icon-btn"
              :class="{ active: library.isFavorited(question.id) }"
              type="button"
              :aria-label="library.isFavorited(question.id) ? '取消收藏' : '收藏'"
              @click="library.toggleFavorite(question.id)"
            >★</button>
            <button class="icon-btn" type="button" @click="tagEditorFor = tagEditorFor === question.id ? '' : question.id">#</button>
          </div>
        </div>

        <!-- Zone 2: Question text -->
        <h3 class="q-title">{{ question.question }}</h3>

        <!-- Zone 3: Options -->
        <div class="option-grid">
          <div class="option-item"><span>A</span><p>{{ question.optionA }}</p></div>
          <div class="option-item"><span>B</span><p>{{ question.optionB }}</p></div>
          <div class="option-item"><span>C</span><p>{{ question.optionC }}</p></div>
          <div class="option-item"><span>D</span><p>{{ question.optionD }}</p></div>
        </div>

        <!-- Zone 4: Tags -->
        <div class="tag-row question-tags">
          <button
            v-for="tag in library.questionTags[questionIdKey(question.id)] || []"
            :key="tag"
            class="tag-chip active"
            type="button"
            @click="library.toggleTag(question.id, tag)"
          >{{ tag }}</button>
        </div>

        <!-- Tag editor -->
        <div v-if="tagEditorFor === question.id" class="tag-editor">
          <button v-for="tag in library.availableTags" :key="tag" class="tag-chip" type="button" @click="library.toggleTag(question.id, tag)">{{ tag }}</button>
          <button class="tag-chip" type="button" @click="addCustomTag(question.id)">+ 新标签</button>
        </div>

        <!-- Zone 5: Answer reveal -->
        <div class="answer-row">
          <template v-if="browse.shouldShowAnswer(question.id)">
            <span class="answer-value">
              <span>答案</span>
              <strong>{{ question.answer }}</strong>
            </span>
            <button v-if="browse.answerMode === 'hide'" class="btn btn-ghost btn-sm" type="button" @click="browse.toggleQuestionReveal(question.id)">收起</button>
          </template>
          <button v-else class="btn btn-ghost btn-sm" type="button" @click="browse.toggleQuestionReveal(question.id)">查看答案</button>
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>

.browse-toolbar {
  position: relative;
  overflow: hidden;
  padding: var(--space-4);
  margin-bottom: var(--space-4);
  background:
    linear-gradient(180deg, rgba(242, 245, 255, 0.45), rgba(255, 255, 255, 0) 72px),
    var(--surface);
}

.browse-toolbar::before {
  content: "";
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--primary);
  opacity: 0.65;
}

.browse-toolbar-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-3);
}

.browse-toolbar-head > div {
  display: grid;
  gap: 2px;
}

.browse-toolbar-head strong {
  font-size: var(--text-card-title);
  font-weight: var(--weight-bold);
  color: var(--text);
}

.browse-toolbar-head span {
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.filter-grid {
  gap: var(--space-3);
}

.filter-grid label {
  gap: 5px;
  min-width: 0;
}

.filter-grid label > span {
  color: var(--text-soft);
  font-weight: var(--weight-semibold);
}

.filter-grid .select-control,
.filter-grid .form-input {
  min-height: 42px;
  border-color: var(--border-soft);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 1px 0 rgba(17, 22, 32, 0.02);
}

.filter-grid .select-control:hover,
.filter-grid .form-input:hover {
  border-color: var(--border-focus);
}

.questions-list {
  gap: var(--space-3);
}

.question-card {
  padding: 18px;
}

.question-card:hover {
  transform: none;
}

.q-meta,
.answer-value {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.q-title {
  margin: 10px 0 14px;
  font-size: 1rem;
  font-weight: var(--weight-semibold);
  line-height: var(--leading-relaxed);
  color: var(--text);
}

.q-actions {
  gap: 4px;
}

.q-actions .icon-btn {
  width: 32px;
  min-width: 32px;
  height: 32px;
  min-height: 32px;
  color: var(--gray-500);
}

.q-actions .icon-btn:hover {
  background: var(--gray-75);
  color: var(--primary);
}

.option-grid {
  gap: 10px;
}

.option-item {
  min-height: 46px;
  padding: 9px 12px;
  border-color: var(--border-soft);
  background: #fbfcfe;
}

.option-item span {
  width: 26px;
  height: 26px;
  background: var(--surface);
  border: 1px solid var(--border-soft);
}

.option-item p {
  margin-top: 2px;
  color: var(--text-soft);
}

.question-tags {
  margin-top: var(--space-2);
}

.answer-row {
  justify-content: space-between;
  margin-top: 10px;
  padding: 8px 10px;
  background: transparent;
}

.answer-value > span {
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.answer-value strong {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 24px;
  border-radius: var(--radius-sm);
  background: var(--success-light);
  color: var(--success);
  font-size: var(--text-caption);
}

@media (max-width: 560px) {
  .question-card {
    padding: var(--space-4);
  }
}

@media (max-width: 900px) {
  .browse-toolbar:has(.filter-grid:not(.filters-open)) {
    display: none;
  }

  .browse-toolbar {
    padding: var(--space-3);
  }

  .browse-toolbar-head {
    margin-bottom: var(--space-2);
  }
}
</style>
