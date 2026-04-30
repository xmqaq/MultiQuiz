<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();

const iconMap: Record<string, string> = {
  info: 'i',
  success: '✓',
  warning: '!',
  error: '×',
};
</script>

<template>
  <div class="toast-container" role="alert" aria-live="polite">
    <div v-for="toast in ui.toasts" :key="toast.id" class="toast" :class="toast.type" @click="ui.dismissToast(toast.id)">
      <span class="toast-icon" aria-hidden="true">{{ iconMap[toast.type] || 'i' }}</span>
      {{ toast.message }}
    </div>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  z-index: 80;
  top: 18px;
  right: 18px;
  display: grid;
  gap: 8px;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: 380px;
  padding: 10px 16px;
  border-radius: var(--radius-lg);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: var(--weight-medium);
  box-shadow: var(--shadow-raised);
  cursor: pointer;
  pointer-events: auto;
  animation: toast-in 0.25s ease;
}

.toast-icon {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  font-weight: var(--weight-bold);
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.toast.info    { background: linear-gradient(135deg, #5577f7, #3f5de5); }
.toast.success { background: linear-gradient(135deg, #22a85d, #158a45); }
.toast.warning { background: linear-gradient(135deg, #d4a03c, #b88528); }
.toast.error   { background: linear-gradient(135deg, #e86666, #d43f3f); }

@media (max-width: 560px) {
  .toast-container {
    left: 12px;
    right: 12px;
    top: 12px;
  }

  .toast {
    max-width: none;
  }
}
</style>
