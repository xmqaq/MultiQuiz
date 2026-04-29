<script setup lang="ts">
import { useUiStore } from '@/stores/ui';

const ui = useUiStore();
</script>

<template>
  <div class="toast-container">
    <div v-for="toast in ui.toasts" :key="toast.id" class="toast" :class="toast.type" @click="ui.dismissToast(toast.id)">
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
  gap: 10px;
}

.toast {
  max-width: 360px;
  padding: 12px 14px;
  border-radius: 8px;
  color: #fff;
  box-shadow: var(--academy-shadow);
}

.toast.info { background: #2563eb; }
.toast.success { background: #059669; }
.toast.warning { background: #d97706; }
.toast.error { background: #dc2626; }

@media (max-width: 560px) {
  .toast-container {
    left: 16px;
    right: 16px;
  }

  .toast {
    max-width: none;
  }
}
</style>
