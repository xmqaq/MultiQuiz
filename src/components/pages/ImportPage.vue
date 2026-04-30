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
        <p class="page-subtitle">支持 Excel (.xlsx/.xls) 和 JSON 格式，自动解析题目与答案</p>
      </div>
    </div>

    <div class="import-layout">
      <!-- Left: Upload workspace -->
      <div class="card-container form-panel">
        <div class="panel-heading">
          <span class="section-kicker">导入工作台</span>
          <h2>上传题库文件</h2>
        </div>

        <!-- Import steps -->
        <div class="import-steps">
          <div class="step-item">
            <span class="step-num">1</span>
            <span class="step-label">填写学科名称</span>
          </div>
          <span class="step-arrow">&rarr;</span>
          <div class="step-item">
            <span class="step-num">2</span>
            <span class="step-label">上传题库文件</span>
          </div>
          <span class="step-arrow">&rarr;</span>
          <div class="step-item">
            <span class="step-num">3</span>
            <span class="step-label">自动解析导入</span>
          </div>
        </div>

        <!-- Subject name -->
        <label class="form-field">
          <span>学科名称</span>
          <input
            v-model="subjectName"
            class="form-input"
            type="text"
            placeholder="例如：近代史纲要、网络安全基础"
          />
        </label>

        <!-- Upload zone -->
        <div class="form-field upload-field">
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
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </div>
              <div class="upload-prompt">
                <strong>拖拽文件到此处，或点击选择</strong>
                <span>最大 50MB</span>
              </div>
              <div class="upload-formats">
                <span class="format-badge">.xlsx</span>
                <span class="format-badge">.xls</span>
                <span class="format-badge">.json</span>
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
        </div>

        <!-- Import button -->
        <div class="import-action">
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
      </div>

      <!-- Right: Info panel -->
      <aside class="card-container info-panel">
        <span class="section-kicker">格式说明</span>

        <h3>文件格式要求</h3>
        <p>Excel 第一行为表头，列顺序固定为 <strong>题目、选项 A-D、正确答案</strong>。JSON 支持题目数组或 <code>{ "questions": [] }</code> 格式。</p>

        <div class="template-actions">
          <button class="btn btn-secondary btn-block" type="button" @click="library.downloadTemplate('excel')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            下载 Excel 模板
          </button>
          <button class="btn btn-secondary btn-block" type="button" @click="library.downloadTemplate('json')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            下载 JSON 模板
          </button>
        </div>

        <h3>注意事项</h3>
        <ul class="import-notes">
          <li>每题必须有 4 个选项和 1 个正确答案</li>
          <li>正确答案必须是 A / B / C / D 之一</li>
          <li>同名学科可选择追加或覆盖导入</li>
        </ul>

        <h3>示例表头</h3>
        <div class="example-headers">
          <span class="example-tag">题目</span>
          <span class="example-tag">选项A</span>
          <span class="example-tag">选项B</span>
          <span class="example-tag">选项C</span>
          <span class="example-tag">选项D</span>
          <span class="example-tag example-tag-answer">正确答案</span>
        </div>
      </aside>
    </div>

    <!-- Bottom hint -->
    <p class="import-footer-hint">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      导入后可在题库中心查看、练习和管理题库
    </p>
  </section>
</template>

<style scoped>
/* ── Page width ── */
.import-page {
  width: min(1060px, 100%);
}

/* ── Panels: tighter, balanced padding ── */
.form-panel,
.info-panel {
  padding: var(--space-6);
}

.form-panel {
  display: grid;
  gap: 0;
}

.info-panel {
  display: grid;
  gap: 0;
}

/* ── Panel heading ── */
.panel-heading {
  display: grid;
  gap: var(--space-1);
  margin-bottom: var(--space-4);
}

.panel-heading h2 {
  margin: 0;
  font-size: var(--text-section-title);
  font-weight: var(--weight-bold);
}

/* ── Import steps ── */
.import-steps {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  background: var(--gray-50);
  border: 1px solid var(--border-soft);
}

.step-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.step-num {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: var(--radius-full);
  background: var(--primary);
  color: #fff;
  font-size: 11px;
  font-weight: var(--weight-bold);
  flex-shrink: 0;
  line-height: 1;
}

.step-label {
  font-size: var(--text-caption);
  color: var(--text-soft);
  font-weight: var(--weight-medium);
  white-space: nowrap;
}

.step-arrow {
  color: var(--gray-300);
  font-size: var(--text-caption);
  flex-shrink: 0;
}

/* ── Form field spacing ── */
.form-field {
  margin-bottom: var(--space-4);
}

.upload-field {
  margin-bottom: var(--space-5);
}

/* ── Upload zone ── */
.upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  min-height: 130px;
  padding: var(--space-6) var(--space-4);
  border: 2px dashed var(--gray-200);
  border-radius: var(--radius-xl);
  background: var(--gray-50);
  cursor: pointer;
  transition: border-color var(--transition-base), background var(--transition-base), box-shadow var(--transition-base);
  text-align: center;
}

.upload-zone:hover {
  border-color: var(--primary-light);
  background: var(--primary-surface);
  box-shadow: 0 0 0 1px rgba(69, 94, 221, 0.06);
}

.upload-zone.drag-over {
  border-color: var(--primary);
  border-style: solid;
  background: var(--primary-surface);
  box-shadow: 0 0 0 4px rgba(69, 94, 221, 0.08);
}

.upload-zone.has-file {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  min-height: auto;
  padding: var(--space-4);
  border-style: solid;
  border-color: var(--border);
  background: var(--surface);
  text-align: left;
}

.upload-zone.has-file:hover {
  border-color: var(--border-focus);
  box-shadow: none;
}

/* ── Upload icon ── */
.upload-icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-lg);
  background: var(--primary-surface);
  color: var(--primary);
  flex-shrink: 0;
}

.upload-prompt {
  display: grid;
  gap: 2px;
}

.upload-prompt strong {
  font-size: var(--text-body);
  font-weight: var(--weight-semibold);
  color: var(--text-soft);
}

.upload-prompt span {
  font-size: var(--text-caption);
  color: var(--text-muted);
}

/* ── Format badges ── */
.upload-formats {
  display: flex;
  gap: var(--space-2);
}

.format-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: var(--radius-full);
  background: var(--surface);
  border: 1px solid var(--border-soft);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: var(--weight-medium);
  font-family: var(--font-mono);
}

/* ── File info (has-file state) ── */
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

/* ── Import action ── */
.import-action {
  display: grid;
  gap: var(--space-2);
}

.import-disabled-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-caption);
  text-align: center;
}

/* ── Info panel headings ── */
.info-panel h3 {
  margin: var(--space-5) 0 var(--space-2);
  font-size: var(--text-card-title);
  font-weight: var(--weight-semibold);
}

.info-panel h3:first-of-type {
  margin-top: var(--space-3);
}

.info-panel p {
  margin: 0;
  color: var(--text-muted);
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
}

.info-panel code {
  color: var(--primary-dark);
  background: var(--primary-surface);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: var(--text-caption);
}

/* ── Template download buttons ── */
.template-actions {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

.template-actions .btn {
  justify-content: flex-start;
}

/* ── Notes list ── */
.import-notes {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding-left: 18px;
  color: var(--text-muted);
  font-size: var(--text-body);
  line-height: var(--leading-relaxed);
}

/* ── Example headers (tag-style) ── */
.example-headers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.example-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: var(--gray-75);
  border: 1px solid var(--border-soft);
  color: var(--text-soft);
  font-size: var(--text-caption);
  font-weight: var(--weight-medium);
}

.example-tag-answer {
  background: var(--primary-surface);
  border-color: rgba(69, 94, 221, 0.12);
  color: var(--primary);
}

/* ── Bottom hint ── */
.import-footer-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  margin-top: var(--space-6);
  color: var(--text-muted);
  font-size: var(--text-caption);
}

.import-footer-hint svg {
  flex-shrink: 0;
  color: var(--gray-400);
}

/* ── Responsive ── */
@media (max-width: 560px) {
  .form-panel,
  .info-panel {
    padding: var(--space-4);
  }

  .import-steps {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--space-2);
    padding: var(--space-3);
  }

  .step-arrow {
    display: none;
  }

  .upload-zone {
    min-height: 110px;
    padding: var(--space-5) var(--space-4);
  }

  .upload-zone.has-file {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
