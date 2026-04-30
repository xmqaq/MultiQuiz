<script setup lang="ts">
import { useUiStore } from '@/stores/ui';
import { computed, onUnmounted, ref, watch } from 'vue';

const ui = useUiStore();
const modalRef = ref<HTMLElement | null>(null);
const titleId = 'modal-title';
const safeActions = computed(() => ui.modal.actions.filter(action => action.style !== 'danger' && action.style !== 'ghost'));
const dangerActions = computed(() => ui.modal.actions.filter(action => action.style === 'danger'));
const ghostActions = computed(() => ui.modal.actions.filter(action => action.style === 'ghost'));
const hasDangerActions = computed(() => dangerActions.value.length > 0);
const dangerDescription = computed(() => dangerActions.value.find(action => action.description)?.description || '此操作可能删除数据，请谨慎处理。');

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
      <div v-if="hasDangerActions" class="modal-actions modal-actions-grouped">
        <div v-if="safeActions.length" class="modal-safe-actions">
          <button
            v-for="(action, index) in safeActions"
            :key="`safe-${index}`"
            class="modal-action-card"
            :class="{
              'primary': !action.style || action.style === 'primary',
              'secondary': action.style === 'secondary'
            }"
            type="button"
            @click="ui.runModalAction(action)"
          >
            <strong>{{ action.label }}</strong>
            <span v-if="action.description">{{ action.description }}</span>
          </button>
        </div>
        <div class="modal-danger-zone">
          <div>
            <strong>危险操作</strong>
            <span>{{ dangerDescription }}</span>
          </div>
          <div class="modal-danger-actions">
            <button
              v-for="(action, index) in dangerActions"
              :key="`danger-${index}`"
              class="btn btn-danger-subtle"
              type="button"
              @click="ui.runModalAction(action)"
            >
              {{ action.label }}
            </button>
          </div>
        </div>
        <div v-if="ghostActions.length" class="modal-cancel-actions">
          <button
            v-for="(action, index) in ghostActions"
            :key="`ghost-${index}`"
            class="btn btn-ghost"
            type="button"
            @click="ui.runModalAction(action)"
          >
            {{ action.label }}
          </button>
        </div>
      </div>
      <div v-else class="modal-actions">
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
  font-weight: var(--weight-extrabold);
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
  background: var(--nav-bg);
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

.modal-safe-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.modal-actions-grouped {
  display: grid;
  justify-content: stretch;
  gap: 12px;
  margin-top: 18px;
}

.modal-action-card {
  display: grid;
  gap: 3px;
  align-content: center;
  min-height: 66px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  text-align: left;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
}

.modal-action-card:hover {
  border-color: rgba(69, 94, 221, 0.22);
  background: var(--primary-surface);
  box-shadow: var(--shadow-card);
  transform: translateY(-1px);
}

.modal-action-card strong {
  font-size: var(--text-body);
  font-weight: var(--weight-semibold);
  color: var(--text);
}

.modal-action-card span {
  font-size: var(--text-caption);
  color: var(--text-muted);
  line-height: 1.4;
}

.modal-danger-zone {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px;
  border: 1px solid rgba(217, 74, 74, 0.14);
  border-radius: var(--radius-lg);
  background: var(--danger-light);
}

.modal-danger-zone > div:first-child {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.modal-danger-zone strong {
  color: var(--text);
  font-size: var(--text-body);
}

.modal-danger-zone span {
  color: var(--text-muted);
  font-size: var(--text-caption);
  line-height: var(--leading-relaxed);
}

.modal-danger-actions,
.modal-cancel-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.btn-danger-subtle {
  border-color: rgba(217, 74, 74, 0.22);
  background: var(--surface);
  color: var(--danger);
}

.btn-danger-subtle:hover {
  border-color: rgba(217, 74, 74, 0.34);
  background: var(--red-100);
  color: var(--danger-dark);
}

.modal-body :deep(.manage-summary) {
  margin: 0;
  padding-bottom: 2px;
}

/* Detail content rendered via v-html in HistoryPage */
.modal-body :deep(.detail-questions) {
  display: grid;
  gap: 12px;
}

.modal-body :deep(.detail-q) {
  padding: 12px;
  border-radius: var(--radius-md);
  background: var(--nav-bg);
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
  background: var(--nav-bg);
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

  .modal-safe-actions {
    grid-template-columns: 1fr;
  }

  .modal-danger-zone {
    display: grid;
  }

  .modal-danger-actions,
  .modal-cancel-actions {
    justify-content: stretch;
  }

  .modal-danger-actions .btn,
  .modal-cancel-actions .btn {
    width: 100%;
  }

  .modal-body :deep(.detail-summary) {
    grid-template-columns: 1fr;
    width: 100%;
  }
}
</style>
