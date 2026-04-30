<script setup lang="ts">
defineProps<{
  title?: string
  description?: string
  compact?: boolean
}>()
</script>

<template>
  <div class="empty-state" :class="{ compact }">
    <div class="empty-icon" aria-hidden="true">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 5.5A3 3 0 0 1 8 4h11v14H8a3 3 0 0 0-3 1.5z" />
        <path d="M5 5.5v14" />
        <path d="M9 8h6" />
        <path d="M9 11h5" />
      </svg>
    </div>
    <div v-if="title" class="empty-title">{{ title }}</div>
    <div v-if="description" class="empty-desc">{{ description }}</div>
    <slot />
  </div>
</template>

<style scoped>
.empty-icon {
  color: var(--primary);
  opacity: 0.3;
  margin-bottom: 4px;
}

.empty-icon svg {
  filter: drop-shadow(0 4px 8px rgba(79, 110, 246, 0.1));
}

.empty-title {
  font-weight: var(--font-weight-extrabold);
  font-size: var(--font-size-lg);
  color: var(--text);
}

.empty-desc {
  color: var(--text-muted);
  max-width: 440px;
  line-height: var(--line-height-relaxed);
  font-size: var(--font-size-sm);
}

.compact {
  min-height: 80px;
  padding: var(--space-4);
}

.compact .empty-icon {
  display: none;
}

.compact .empty-title {
  font-size: var(--font-size-md);
}
</style>
