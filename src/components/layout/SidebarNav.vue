<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router';
import { tabs, useUiStore } from '@/stores/ui';
import TabIcon from '@/components/common/TabIcon.vue';

defineProps<{ isMobile: boolean }>();

const router = useRouter();
const route = useRoute();
const ui = useUiStore();

function navTo(tabId: string) {
  router.push(tabId === 'subjects' ? '/' : `/${tabId}`);
}

function isActive(tabId: string): boolean {
  if (tabId === 'subjects') return route.path === '/';
  return route.path === `/${tabId}`;
}
</script>

<template>
  <aside class="sidebar" aria-label="主导航">

    <!-- Brand -->
    <div class="sidebar-brand">
      <div class="brand-icon">
        <img src="/ico.png" alt="MultiQuiz" />
      </div>
      <div class="brand-text">
        <div class="brand-name">MultiQuiz</div>
        <div class="brand-sub">题库练习平台</div>
      </div>
      <button
        class="sidebar-toggle"
        type="button"
        @click="ui.toggleSidebar(isMobile)"
        :aria-label="ui.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
      >
        {{ isMobile ? '×' : (ui.sidebarCollapsed ? '»' : '«') }}
      </button>
    </div>

    <!-- Nav items -->
    <nav class="sidebar-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="nav-item"
        :class="{ active: isActive(tab.id) }"
        type="button"
        :aria-label="tab.label"
        @click="navTo(tab.id)"
      >
        <span class="nav-icon" aria-hidden="true"><TabIcon :name="tab.id" /></span>
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>

    <!-- Footer -->
    <div class="sidebar-footer">
      <span class="sidebar-credit">MultiQuiz · xmqaq</span>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  padding: 8px 8px 10px;
  transition: width var(--transition-base), padding var(--transition-base);
  z-index: 10;
  border-right: 1px solid var(--nav-border);
  background: var(--nav-bg);
}

/* ── Brand ── */
.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
  height: 64px;
  padding: 0 6px;
  margin-bottom: 2px;
  border-bottom: 1px solid var(--border-soft);
}

.brand-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--primary);
  flex-shrink: 0;
}

.brand-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-text {
  flex: 1;
  min-width: 0;
}

.brand-name {
  font-weight: var(--weight-extrabold);
  font-size: var(--text-card-title);
  color: var(--text);
  line-height: 1.2;
  letter-spacing: 0;
}

.brand-sub {
  color: var(--text-muted);
  font-size: var(--text-caption);
  margin-top: 1px;
}

/* ── Toggle ── */
.sidebar-toggle {
  display: inline-grid;
  place-items: center;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  min-width: 26px;
  min-height: 26px;
  padding: 0;
  font-weight: var(--weight-bold);
  font-size: var(--text-caption);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.sidebar-toggle:hover {
  background: var(--gray-75);
  color: var(--text);
}

/* ── Nav ── */
.sidebar-nav {
  display: grid;
  gap: 4px;
  padding: 22px 0 2px;
  flex: 1;
  overflow-y: auto;
  align-content: start;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  border-left: 3px solid transparent;
  border-radius: var(--radius-lg);
  padding: 0 10px 0 9px;
  margin-left: 0;
  min-height: 40px;
  color: var(--text-soft);
  background: transparent;
  text-align: left;
  font-size: var(--text-body);
  font-weight: var(--weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-item:hover {
  color: var(--text);
  background: var(--gray-75);
}

.nav-item.active {
  color: var(--primary);
  border-left-color: var(--primary);
  background: var(--primary-surface);
  font-weight: var(--weight-semibold);
}

/* ── Icon ── */
.nav-icon {
  display: inline-grid;
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  place-items: center;
  border-radius: var(--radius-sm);
  font-size: 0;
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.nav-item.active .nav-icon {
  color: var(--primary);
}

.nav-icon :deep(.tab-icon-svg) {
  width: 17px;
  height: 17px;
}

/* ── Label ── */
.nav-label {
  font-size: var(--text-body);
  white-space: nowrap;
}

/* ── Footer ── */
.sidebar-footer {
  margin-top: auto;
  display: block;
  padding: 10px 8px 4px;
  border-top: 1px solid var(--border-soft);
}

.sidebar-credit {
  font-size: 11px;
  line-height: 1.4;
  color: var(--gray-400);
  letter-spacing: 0;
}

/* ═══════════════════════════════════════════════════════════
   Mobile (≤900px) — frosted slide-in
   ═══════════════════════════════════════════════════════════ */
@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    z-index: 40;
    transform: translateX(-100%);
    width: min(260px, 78vw);
    padding: 12px 10px;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: 12px 0 40px rgba(0, 0, 0, 0.08);
  }
}
</style>
