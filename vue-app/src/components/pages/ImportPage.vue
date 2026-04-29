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

function chooseFile() {
  fileInput.value?.click();
}

function onFileChange(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] || null;
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
        <p class="page-subtitle">支持 Excel 与 JSON；首次导入建议先下载模板</p>
      </div>
    </div>

    <div class="import-layout">
      <div class="form-panel">
        <div class="panel-heading">
          <span class="section-kicker">导入工作台</span>
          <h2>添加新的练习题库</h2>
          <p>上传 Excel 或 JSON 文件，系统会自动解析题目、选项和正确答案。</p>
        </div>
        <label class="form-field">
          <span>学科名称</span>
          <input v-model="subjectName" class="form-input" type="text" placeholder="例如：近代史、网络安全、马克思原理" />
        </label>
        <label class="form-field">
          <span>题库文件</span>
          <div class="upload-drop" :class="{ 'has-file': selectedFile }" @click="chooseFile">
            <input ref="fileInput" type="file" accept=".xlsx,.xls,.json" hidden @change="onFileChange" />
            <span class="upload-mark" aria-hidden="true">+</span>
            <div class="upload-copy">
              <strong>{{ selectedFile?.name || '选择题库文件' }}</strong>
              <small>{{ selectedFile ? '文件已准备好，点击导入即可解析' : '支持 .xlsx / .xls / .json 格式' }}</small>
            </div>
            <button class="btn btn-secondary" type="button" @click.stop="chooseFile">选择文件</button>
          </div>
        </label>
        <button class="btn btn-primary btn-block" type="button" :disabled="importing" @click="runImport()">
          {{ importing ? '正在导入...' : '导入题库' }}
        </button>
      </div>
      <aside class="info-panel">
        <span class="section-kicker">模板与格式</span>
        <h3>导入说明</h3>
        <p>Excel 第一行为表头，列顺序固定为题目、选项 A-D、正确答案。JSON 支持题目数组或 <code>{ "questions": [] }</code>。</p>
        <div class="template-actions">
          <button class="btn btn-secondary" type="button" @click="library.downloadTemplate('excel')">下载 Excel 模板</button>
          <button class="btn btn-secondary" type="button" @click="library.downloadTemplate('json')">下载 JSON 模板</button>
        </div>
      </aside>
    </div>
  </section>
</template>
