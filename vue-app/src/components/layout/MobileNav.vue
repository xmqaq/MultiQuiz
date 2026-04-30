<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { tabs } from '@/stores/ui';
import TabIcon from '@/components/common/TabIcon.vue';

const router = useRouter();
const route = useRoute();
const visibleTabs = tabs.filter(tab => ['subjects', 'browse', 'exam', 'wrong', 'history'].includes(tab.id));

function navTo(tabId: string) {
  router.push(tabId === 'subjects' ? '/' : `/${tabId}`);
}

function isActive(tabId: string): boolean {
  if (tabId === 'subjects') return route.path === '/';
  return route.path === `/${tabId}`;
}
</script>

<template>
  <nav class="mobile-nav" aria-label="移动端导航">
    <button
      v-for="tab in visibleTabs"
      :key="tab.id"
      class="mobile-nav-item"
      :class="{ active: isActive(tab.id) }"
      type="button"
      :aria-label="tab.label"
      @click="navTo(tab.id)"
    >
      <span class="mobile-nav-icon" aria-hidden="true"><TabIcon :name="tab.id" /></span>
      <span class="mobile-nav-label">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.mobile-nav {
  display: none;
}

.mobile-nav-icon {
  font-size: 0;
}

.mobile-nav-icon :deep(.tab-icon-svg) {
  width: 16px;
  height: 16px;
}

@media (max-width: 900px) {
  .mobile-nav {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 30;
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    min-height: var(--mobile-nav-height);
    border-top: 1px solid var(--border-soft);
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.06);
  }

  .mobile-nav-item {
    display: grid;
    gap: 3px;
    place-items: center;
    border: 0;
    min-width: 0;
    min-height: var(--mobile-nav-height);
    padding: 6px 2px 8px;
    border-top: 3px solid transparent;
    background: transparent;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: var(--weight-medium);
    line-height: 1.2;
    cursor: pointer;
    transition: all var(--transition-base);
  }

  .mobile-nav-item:hover {
    color: var(--text-soft);
  }

  .mobile-nav-item.active {
    border-top-color: var(--primary);
    color: var(--primary);
    font-weight: var(--weight-semibold);
    background: var(--primary-surface);
  }

  .mobile-nav-icon {
    display: inline-grid;
    width: 28px;
    height: 28px;
    place-items: center;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-muted);
    transition: all var(--transition-base);
  }

  .mobile-nav-item.active .mobile-nav-icon {
    color: #fff;
    background: var(--primary);
    box-shadow: 0 4px 12px rgba(79, 110, 246, 0.28);
  }

  .mobile-nav-label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
