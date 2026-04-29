<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { tabs, useUiStore } from '@/stores/ui';
import TabIcon from '@/components/common/TabIcon.vue';

const router = useRouter();
const route = useRoute();
const ui = useUiStore();
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
    min-height: 70px;
    border-top: 1px solid rgba(205, 217, 232, 0.92);
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(18px);
    box-shadow: 0 -12px 28px rgba(35, 55, 88, 0.08);
  }

  .mobile-nav-item {
    display: grid;
    gap: 2px;
    place-items: center;
    border: 0;
    min-width: 0;
    min-height: 70px;
    padding: 7px 2px 8px;
    border-top: 3px solid transparent;
    background: transparent;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.2;
  }

  .mobile-nav-item.active {
    border-top-color: var(--primary);
    color: var(--primary);
    background: linear-gradient(180deg, rgba(63, 111, 219, 0.11), rgba(255, 255, 255, 0));
  }

  .mobile-nav-icon {
    display: inline-grid;
    width: 26px;
    height: 26px;
    place-items: center;
    border-radius: 8px;
    background: linear-gradient(135deg, #f0f5ff, #fff8ea);
    color: var(--primary);
  }

  .mobile-nav-item.active .mobile-nav-icon {
    color: var(--primary);
    background: #fff;
    box-shadow: 0 8px 18px rgba(63, 111, 219, 0.17);
  }

  .mobile-nav-label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-nav-item:focus-visible {
    outline: none;
    box-shadow: none;
  }

  .mobile-nav-item:focus-visible .mobile-nav-icon {
    box-shadow: 0 0 0 2px rgba(49, 88, 212, 0.34);
  }
}
</style>
