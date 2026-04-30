<script setup lang="ts">
import { ref } from 'vue';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';

const library = useLibraryStore();
const ui = useUiStore();
const subjectName = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const importing = ref(false);
const dragOver = ref(false);

function chooseFile() {
  fileInput.value?.click();
}

function onFileChange(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] || null;
}

function onDragOver(e: DragEvent) {
  e.preventDefault();
  dragOver.value = true;
}

function onDragLeave() {
  dragOver.value = false;
}

function onDrop(e: DragEvent) {
  e.preventDefault();
  dragOver.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) {
    selectedFile.value = file;
  }
}

function clearFile() {
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = '';
}

async function runImport(mode: 'append' | 'replace' | 'new' = 'new') {
  if (!subjectName.value.trim()) {
    ui.showToast('请填写学科名称', 'error');
    return;
  }
  if (!selectedFile.value) {
    ui.showToast('请选择题库文件', 'error');
    return;
  }

  const existing = library.subjects.find(subject => subject.name === subjectName.value.trim());
  if (existing && mode === 'new') {
    ui.showModal(`学科「${subjectName.value.trim()}」已存在`, '请选择追加题目还是覆盖原题库。', [
      { label: '追加题目', action: () => runImport('append') },
      { label: '覆盖题库', style: 'danger', action: () => runImport('replace') },
      { label: '取消', style: 'ghost', action: () => {} }
    ]);
    return;
  }

  importing.value = true;
  try {
    await library.importSubject(subjectName.value.trim(), selectedFile.value, mode);
    subjectName.value = '';
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
    ui.switchTab('subjects');
  } catch (error) {
    ui.showToast(error instanceof Error ? error.message : '导入失败', 'error');
  } finally {
    importing.value = false;
  }
}
</script>

<template>
  <section class="page import-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">导入题库</h1>
        <p class="page-subtitle">支持 Excel (.xlsx/.xls) 和 JSON 格式</p>
      </div>
    </div>

    <div class="import-layout">
      <!-- Left: Upload workspace -->
      <div class="card-container form-panel">
        <div class="panel-heading">
          <span class="section-kicker">导入工作台</span>
          <h2>上传题库文件</h2>
          <p>填写学科名称并选择文件，系统会自动解析题目、选项和正确答案。</p>
        </div>

        <!-- Subject name -->
        <label class="form-field">
          <span>学科名称</span>
          <input
            v-model="subjectName"
            class="form-input"
            type="text"
            placeholder="例如：近代史纲要、网络安全基础、马克思主义原理"
          />
        </label>

        <!-- Upload zone -->
        <label class="form-field">
          <span>题库文件</span>
          <div
            class="upload-zone"
            :class="{ 'has-file': selectedFile, 'drag-over': dragOver }"
            @click="chooseFile"
            @dragover="onDragOver"
            @dragleave="onDragLeave"
            @drop="onDrop"
          >
            <input ref="fileInput" type="file" accept=".xlsx,.xls,.json" hidden @change="onFileChange" />

            <template v-if="!selectedFile">
              <div class="upload-icon" aria-hidden="true">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div>
                <strong>拖拽文件到此处，或点击选择</strong>
                <span>支持 .xlsx / .xls / .json，最大 50MB</span>
              </div>
            </template>

            <template v-else>
              <div class="upload-file-info">
                <span class="file-badge">{{ selectedFile.name.endsWith('.json') ? 'JSON' : 'Excel' }}</span>
                <strong>{{ selectedFile.name }}</strong>
                <span>{{ (selectedFile.size / 1024).toFixed(1) }} KB</span>
              </div>
              <button class="btn btn-ghost btn-sm" type="button" @click.stop="clearFile">移除</button>
            </template>
          </div>
        </label>

        <!-- Import button -->
        <button
          class="btn btn-primary btn-block btn-lg"
          type="button"
          :disabled="importing || !subjectName.trim() || !selectedFile"
          @click="runImport()"
        >
          {{ importing ? '解析中...' : '导入题库' }}
        </button>
        <p v-if="!selectedFile || !subjectName.trim()" class="import-disabled-hint">
          请选择题库文件并填写学科名称后导入
        </p>
      </div>

      <!-- Right: Info panel -->
      <aside class="card-container info-panel">
        <span class="section-kicker">格式说明</span>
        <h3>文件格式要求</h3>
        <p>Excel 第一行为表头，列顺序固定为 <strong>题目、选项 A-D、正确答案</strong>。JSON 支持题目数组或 <code>{ "questions": [] }</code> 格式。</p>

        <div class="template-actions">
          <button class="btn btn-secondary btn-block" type="button" @click="library.downloadTemplate('excel')">
            下载 Excel 模板
          </button>
          <button class="btn btn-secondary btn-block" type="button" @click="library.downloadTemplate('json')">
            下载 JSON 模板
          </button>
        </div>

        <h3 class="notes-title">注意事项</h3>
        <ul class="import-notes">
          <li>每题必须有 4 个选项和 1 个正确答案</li>
          <li>正确答案必须是 A/B/C/D 之一</li>
          <li>同名学科可选择追加或覆盖导入</li>
          <li>导入后可在题库中心查看和管理</li>
        </ul>

        <div class="format-example">
          <span>示例表头</span>
          <code>题目 / 选项A / 选项B / 选项C / 选项D / 正确答案</code>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.import-page {
  width: min(980px, 100%);
}

.form-panel,
.info-panel {
  padding: var(--card-padding);
}

.panel-heading {
  margin-bottom: var(--space-3);
}

.upload-zone {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-height: 92px;
  padding: var(--space-4);
  border: 2px dashed var(--border);
  border-radius: var(--radius-xl);
  background: var(--gray-50);
  cursor: pointer;
  transition: all var(--transition-base);
}

.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--primary);
  border-style: solid;
  background: var(--primary-surface);
}

.upload-zone.has-file {
  display: flex;
  justify-content: space-between;
  border-style: solid;
  border-color: var(--border);
  background: var(--surface);
}

.upload-icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: var(--radius-lg);
  background: var(--primary-surface);
  color: var(--primary);
  flex-shrink: 0;
}

.import-disabled-hint {
  margin: var(--space-2) 0 0;
  color: var(--text-muted);
  font-size: var(--text-caption);
  text-align: center;
}

.notes-title {
  margin-top: var(--space-4);
}

.import-notes {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted);
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
}

.format-example {
  display: grid;
  gap: 4px;
  margin-top: var(--space-4);
  padding: var(--space-3);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-md);
  background: var(--gray-50);
}

.format-example span {
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.upload-file-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.file-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--primary-surface);
  color: var(--primary);
  font-size: var(--text-caption);
  font-weight: var(--weight-semibold);
  flex-shrink: 0;
}

.upload-file-info strong {
  font-size: var(--text-body);
  font-weight: var(--weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.upload-file-info span {
  color: var(--text-muted);
  font-size: var(--text-caption);
  flex-shrink: 0;
}

@media (max-width: 560px) {
  .upload-zone {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-4);
  }

  .upload-zone.has-file {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
