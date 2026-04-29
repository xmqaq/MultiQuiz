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
        <p class="page-subtitle">浏览、搜索、标签和收藏所有题目</p>
      </div>
    </div>

    <div class="browse-toolbar">
      <div class="toolbar-head">
        <div>
          <strong>学习筛选</strong>
          <span>{{ browse.summary }} · {{ browse.filteredQuestions.length }} 道题</span>
        </div>
        <div class="toolbar-actions">
          <button class="btn btn-secondary mobile-filter-toggle" type="button" @click="ui.mobileBrowseFiltersOpen = !ui.mobileBrowseFiltersOpen">
            {{ ui.mobileBrowseFiltersOpen ? '收起筛选' : '展开筛选' }}
          </button>
          <button class="btn btn-secondary" type="button" @click="browse.toggleAnswerMode">
            {{ browse.answerMode === 'hide' ? '显示答案' : '隐藏答案' }}
          </button>
          <button class="btn btn-ghost" type="button" @click="showExportActions">更多操作</button>
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
          <span>收藏状态</span>
          <select v-model="browse.favoriteFilter" class="select-control">
            <option value="all">全部收藏状态</option>
            <option value="favorited">仅收藏</option>
            <option value="unfavorited">未收藏</option>
          </select>
        </label>
        <label>
          <span>搜索</span>
          <input v-model="browse.search" class="form-input" type="search" placeholder="搜索题干或选项" />
        </label>
      </div>
    </div>

    <div v-if="browse.filteredQuestions.length === 0" class="empty-state">
      <div class="empty-title">{{ library.totalQuestions === 0 ? '请先导入题库' : '没有匹配题目' }}</div>
    </div>

    <div v-else class="questions-list">
      <article v-for="(question, index) in browse.filteredQuestions" :key="question.id" class="question-card">
        <div class="q-header">
          <div>
            <span class="q-index">#{{ index + 1 }}</span>
            <span class="subject-tag">{{ question._subjectName }}</span>
          </div>
          <div class="q-actions">
            <button class="icon-btn" :class="{ active: library.isFavorited(question.id) }" type="button" @click="library.toggleFavorite(question.id)">
              ★
            </button>
            <button class="icon-btn" type="button" @click="tagEditorFor = tagEditorFor === question.id ? '' : question.id">标记</button>
          </div>
        </div>
        <h3 class="q-title">{{ question.question }}</h3>
        <div class="option-grid">
          <div class="option-item"><span>A</span><p>{{ question.optionA }}</p></div>
          <div class="option-item"><span>B</span><p>{{ question.optionB }}</p></div>
          <div class="option-item"><span>C</span><p>{{ question.optionC }}</p></div>
          <div class="option-item"><span>D</span><p>{{ question.optionD }}</p></div>
        </div>
        <div class="tag-row">
          <button
            v-for="tag in library.questionTags[questionIdKey(question.id)] || []"
            :key="tag"
            class="tag-chip active"
            type="button"
            @click="library.toggleTag(question.id, tag)"
          >
            {{ tag }}
          </button>
        </div>
        <div v-if="tagEditorFor === question.id" class="tag-editor">
          <button v-for="tag in library.availableTags" :key="tag" class="tag-chip" type="button" @click="library.toggleTag(question.id, tag)">
            {{ tag }}
          </button>
          <button class="tag-chip" type="button" @click="addCustomTag(question.id)">+ 新标签</button>
        </div>
        <div class="answer-row">
          <template v-if="browse.shouldShowAnswer(question.id)">
            <span>正确答案</span>
            <strong>{{ question.answer }}</strong>
            <button v-if="browse.answerMode === 'hide'" class="btn btn-sm btn-ghost" type="button" @click="browse.toggleQuestionReveal(question.id)">收起答案</button>
          </template>
          <button v-else class="btn btn-sm btn-secondary" type="button" @click="browse.toggleQuestionReveal(question.id)">显示答案</button>
        </div>
      </article>
    </div>
  </section>
</template>
