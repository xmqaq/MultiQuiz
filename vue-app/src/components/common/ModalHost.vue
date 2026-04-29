<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div v-if="ui.modal.open" class="modal-overlay" @click.self="ui.closeModal()">
    <div class="modal-box" :class="{ 'modal-large': ui.modal.large }">
      <div class="modal-header">
        <h3 class="modal-title">{{ ui.modal.title }}</h3>
        <button class="modal-close" type="button" @click="ui.closeModal()">×</button>
      </div>
      <div v-if="ui.modal.html" class="modal-body" v-html="ui.modal.html" />
      <div v-else class="modal-body">{{ ui.modal.message }}</div>
      <div class="modal-actions">
        <button
          v-for="action in ui.modal.actions"
          :key="action.label"
          class="btn"
          :class="{
            'btn-primary': !action.style || action.style === 'primary',
            'btn-secondary': action.style === 'secondary',
            'btn-danger': action.style === 'danger',
            'btn-ghost': action.style === 'ghost'
          }"
          type="button"
          @click="ui.runModalAction(action)"
        >
          {{ action.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(15, 23, 42, 0.55);
}

.modal-box {
  width: min(520px, 100%);
  max-height: 88vh;
  overflow: auto;
  padding: 18px;
  border-radius: 14px;
  background: var(--panel);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.24);
  border: 1px solid rgba(205, 217, 232, 0.9);
}

.modal-large {
  width: min(920px, 100%);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.modal-title {
  margin: 0;
}

.modal-close {
  border: 0;
  background: transparent;
  font-size: 26px;
}

.modal-body {
  color: var(--muted);
  line-height: 1.7;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

/* Detail content rendered via v-html in HistoryPage */
.modal-body :deep(.detail-questions) {
  display: grid;
  gap: 12px;
}

.modal-body :deep(.detail-q) {
  padding: 12px;
  border-radius: 8px;
  background: var(--panel-2);
}

.modal-body :deep(.detail-q.correct) {
  border-left: 4px solid var(--success);
}

.modal-body :deep(.detail-q.wrong) {
  border-left: 4px solid var(--danger);
}

.modal-body :deep(.detail-summary) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 16px 0;
}

.modal-body :deep(.detail-summary div) {
  display: grid;
  gap: 3px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(224, 229, 238, 0.96);
  background: linear-gradient(180deg, #fbfcff, #f8f9fc);
}

.modal-body :deep(.detail-summary strong) {
  font-size: 20px;
}

.modal-body :deep(.detail-summary span) {
  color: var(--muted);
  font-size: 12px;
}

@media (min-width: 901px) {
  .modal-title {
    font-size: 18px;
  }

  .modal-body :deep(.detail-summary) {
    gap: 8px;
    margin: 12px 0;
  }

  .modal-body :deep(.detail-summary div) {
    padding: 9px;
  }

  .modal-body :deep(.detail-summary strong) {
    font-size: 18px;
  }
}

@media (max-width: 560px) {
  .modal-body :deep(.detail-summary) {
    grid-template-columns: 1fr;
    width: 100%;
  }
}
</style>
