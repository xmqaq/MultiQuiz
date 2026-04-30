<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import { onUnmounted, ref, watch } from 'vue';

const ui = useUiStore();
const modalRef = ref<HTMLElement | null>(null);
const titleId = 'modal-title';

let previousActiveElement: HTMLElement | null = null;

function getFocusableElements(): HTMLElement[] {
  if (!modalRef.value) return [];
  return Array.from(modalRef.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ));
}

function trapFocus(event: KeyboardEvent) {
  if (!ui.modal.open || event.key !== 'Tab') return;
  const focusable = getFocusableElements();
  if (focusable.length === 0) return;

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    ui.closeModal();
    return;
  }
  trapFocus(event);
}

watch(() => ui.modal.open, (open) => {
  if (open) {
    previousActiveElement = document.activeElement as HTMLElement | null;
    document.addEventListener('keydown', handleKeydown);
    // Focus the first focusable element after mount
    requestAnimationFrame(() => {
      const focusable = getFocusableElements();
      if (focusable.length > 0) {
        const first = focusable[0]!;
        first.focus();
      }
    });
  } else {
    document.removeEventListener('keydown', handleKeydown);
    if (previousActiveElement) {
      previousActiveElement.focus();
      previousActiveElement = null;
    }
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div
    v-if="ui.modal.open"
    class="modal-overlay"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    @click.self="ui.closeModal()"
  >
    <div ref="modalRef" class="modal-box" :class="{ 'modal-large': ui.modal.large }">
      <div class="modal-header">
        <h3 :id="titleId" class="modal-title">{{ ui.modal.title }}</h3>
        <button class="modal-close" type="button" aria-label="关闭对话框" @click="ui.closeModal()">&times;</button>
      </div>
      <div v-if="ui.modal.html" class="modal-body" v-html="ui.modal.html" />
      <div v-else class="modal-body">{{ ui.modal.message }}</div>
      <div class="modal-actions">
        <button
          v-for="(action, index) in ui.modal.actions"
          :key="index"
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
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  animation: overlay-in 0.15s ease;
}

@keyframes overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-box {
  width: min(520px, 100%);
  max-height: 88vh;
  overflow: auto;
  padding: 20px;
  border-radius: var(--radius-2xl);
  background: var(--surface);
  box-shadow: 0 24px 72px rgba(0, 0, 0, 0.18), 0 1px 0 rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-soft);
  animation: modal-in 0.2s ease;
}

@keyframes modal-in {
  from { opacity: 0; transform: translateY(12px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.modal-large {
  width: min(920px, 100%);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.modal-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-extrabold);
}

.modal-close {
  border: 0;
  background: transparent;
  font-size: 26px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  padding: 0 4px;
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.modal-close:hover {
  color: var(--text);
  background: var(--panel-2);
}

.modal-body {
  color: var(--text-muted);
  line-height: var(--line-height-relaxed);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

/* Detail content rendered via v-html in HistoryPage */
.modal-body :deep(.detail-questions) {
  display: grid;
  gap: 12px;
}

.modal-body :deep(.detail-q) {
  padding: 12px;
  border-radius: var(--radius-md);
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
  border-radius: var(--radius-md);
  border: 1px solid var(--border-soft);
  background: var(--panel-2);
}

.modal-body :deep(.detail-summary strong) {
  font-size: 20px;
}

.modal-body :deep(.detail-summary span) {
  color: var(--text-muted);
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
  .modal-box {
    padding: 16px;
    border-radius: var(--radius-xl);
  }

  .modal-body :deep(.detail-summary) {
    grid-template-columns: 1fr;
    width: 100%;
  }
}
</style>
