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
  padding: var(--space-3);
  margin-bottom: var(--space-3);
}

.filter-grid {
  gap: var(--space-2);
}

.filter-grid label {
  gap: 3px;
}

.questions-list {
  gap: var(--space-3);
}

.question-card {
  padding: var(--card-padding-compact);
}

.q-meta,
.answer-value {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.q-title {
  margin: var(--space-2) 0 var(--space-3);
}

.option-grid {
  gap: var(--space-2);
}

.option-item {
  min-height: 40px;
  padding: 7px var(--space-3);
}

.option-item span {
  width: 24px;
  height: 24px;
}

.option-item p {
  margin-top: 1px;
}

.question-tags {
  margin-top: var(--space-2);
}

.answer-row {
  margin-top: var(--space-2);
}
</style>
