<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { tabs, useUiStore } from '@/stores/ui';
import { useLibraryStore } from '@/stores/library';
import TabIcon from '@/components/common/TabIcon.vue';

defineProps<{ isMobile: boolean }>();

const router = useRouter();
const route = useRoute();
const ui = useUiStore();
const library = useLibraryStore();

const totalQuestions = computed(() => library.totalQuestions);

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
    <div class="sidebar-brand">
      <div class="brand-icon">
        <img src="/ico.png" alt="MultiQuiz" />
      </div>
      <div class="brand-text">
        <div class="brand-name">MultiQuiz</div>
        <div class="brand-sub">Vue 题库练习平台</div>
      </div>
      <button class="sidebar-toggle" type="button" @click="ui.toggleSidebar(isMobile)" :aria-label="ui.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'">
        {{ isMobile ? '×' : (ui.sidebarCollapsed ? '»' : '«') }}
      </button>
    </div>
    <nav class="sidebar-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="nav-item"
        :class="{ active: isActive(tab.id) }"
        type="button"
        :title="tab.label"
        @click="navTo(tab.id)"
      >
        <span class="nav-icon" aria-hidden="true"><TabIcon :name="tab.id" /></span>
        <span class="nav-label">{{ tab.label }}</span>
      </button>
    </nav>
    <div class="sidebar-footer">
      <div class="sidebar-stats-main">
        <div class="sf-item">
          <span class="sf-num">{{ library.subjects.length }}</span>
          <span class="sf-label">学科</span>
        </div>
        <div class="sf-divider" />
        <div class="sf-item">
          <span class="sf-num">{{ totalQuestions }}</span>
          <span class="sf-label">题目</span>
        </div>
        <div class="sidebar-credit">by xmqaq</div>
      </div>
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
  padding: 18px;
  transition: width 0.2s ease, transform 0.2s ease;
  z-index: 10;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 45%),
    linear-gradient(145deg, #28354d 0%, #202d43 58%, #1a2538 100%);
  color: #f8fafc;
  box-shadow: 14px 0 34px rgba(42, 47, 60, 0.075);
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  min-height: 66px;
}

.brand-icon {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  overflow: hidden;
  background: transparent;
  box-shadow: none;
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
  font-weight: 800;
  font-size: 18px;
}

.brand-sub {
  color: #d1d7e3;
  font-size: 12px;
}

.sidebar-toggle {
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 8px;
  min-width: 36px;
  min-height: 36px;
  display: inline-grid;
  place-items: center;
  padding: 0 10px;
  font-weight: 750;
}

.sidebar-toggle:hover {
  background: rgba(255, 255, 255, 0.14);
}

.sidebar-nav {
  display: grid;
  gap: 8px;
  padding: 16px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 10px;
  color: #eef2f8;
  background: transparent;
  text-align: left;
  min-height: 44px;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-item.active {
  border-color: rgba(188, 202, 238, 0.52);
  background:
    linear-gradient(135deg, rgba(92, 131, 226, 0.34), rgba(194, 138, 54, 0.1)),
    rgba(255, 255, 255, 0.08);
  color: #fff;
}

.nav-icon {
  display: inline-grid;
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 8px;
  font-size: 0;
  background: rgba(255, 255, 255, 0.13);
  color: #d8deeb;
}

.nav-item.active .nav-icon {
  background: #ffffff;
  color: var(--academy-blue);
  box-shadow: 0 8px 18px rgba(40, 93, 216, 0.2);
}

.nav-icon :deep(.tab-icon-svg) {
  width: 16px;
  height: 16px;
}

.nav-label {
  font-size: 14px;
  font-weight: 650;
}

.sidebar-footer {
  margin-top: auto;
  display: grid;
  gap: 0;
  margin-bottom: 2px;
  color: #d6deea;
}

.sidebar-stats-main {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
  padding: 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(230, 235, 244, 0.22);
}

.sf-item {
  display: grid;
  gap: 2px;
  text-align: center;
}

.sf-num {
  font-size: 20px;
  font-weight: 800;
}

.sf-label {
  font-size: 12px;
  color: #d1d7e3;
}

.sf-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.16);
}

.sidebar-credit {
  grid-column: 1 / -1;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.11);
  color: #d1d7e3;
  font-size: 12px;
  letter-spacing: 0;
  text-align: center;
}

/* Desktop warm navigation overrides */
@media (min-width: 901px) {
  .sidebar {
    color: var(--academy-ink);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(252, 251, 248, 0.96)),
      #fff;
    border-right: 1px solid rgba(219, 225, 234, 0.95);
    box-shadow: 12px 0 30px rgba(42, 47, 60, 0.055);
  }

  .sidebar-brand {
    border-bottom-color: rgba(217, 224, 235, 0.92);
  }

  .brand-name {
    color: var(--academy-ink);
  }

  .brand-sub,
  .sf-label,
  .sidebar-credit {
    color: var(--academy-muted);
  }

  .sidebar-toggle {
    color: var(--academy-ink);
    background: #f6f8fb;
    border-color: rgba(211, 219, 231, 0.95);
    box-shadow: none;
  }

  .sidebar-toggle:hover {
    background: #fff;
    border-color: rgba(63, 111, 219, 0.24);
  }

  .nav-item {
    color: #394357;
  }

  .nav-item:hover {
    color: var(--academy-blue);
    background: #f5f8fd;
  }

  .nav-item.active {
    color: var(--academy-blue);
    border-color: rgba(63, 111, 219, 0.22);
    background:
      linear-gradient(135deg, rgba(63, 111, 219, 0.11), rgba(194, 138, 54, 0.055)),
      #fff;
    box-shadow: 0 8px 20px rgba(42, 47, 60, 0.055);
  }

  .nav-icon {
    color: #6e7788;
    background: #f0f3f8;
  }

  .nav-item:hover .nav-icon,
  .nav-item.active .nav-icon {
    color: var(--academy-blue);
    background: #fff;
    box-shadow: 0 7px 16px rgba(63, 111, 219, 0.13);
  }

  .sidebar-stats-main {
    color: var(--academy-ink);
    background:
      linear-gradient(135deg, rgba(63, 111, 219, 0.06), rgba(194, 138, 54, 0.045)),
      #fff;
    border-color: rgba(217, 224, 235, 0.92);
    box-shadow: 0 8px 22px rgba(42, 47, 60, 0.052);
  }

  .sf-divider,
  .sidebar-credit {
    border-color: rgba(217, 224, 235, 0.95);
  }
}

/* Mobile sidebar */
@media (max-width: 900px) {
  .sidebar {
    position: fixed;
    z-index: 40;
    transform: translateX(-100%);
    width: min(320px, 84vw);
    box-shadow: 18px 0 52px rgba(15, 23, 42, 0.26);
  }
}
</style>
