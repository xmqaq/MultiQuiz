<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import SidebarNav from '@/components/layout/SidebarNav.vue';
import MobileNav from '@/components/layout/MobileNav.vue';
import ToastHost from '@/components/common/ToastHost.vue';
import ModalHost from '@/components/common/ModalHost.vue';
import TabIcon from '@/components/common/TabIcon.vue';
import { useBrowseStore } from '@/stores/browse';
import { useExamStore } from '@/stores/exam';
import { useLibraryStore } from '@/stores/library';
import { useUiStore } from '@/stores/ui';

const router = useRouter();
const route = useRoute();
const ui = useUiStore();
const library = useLibraryStore();
const browse = useBrowseStore();
const exam = useExamStore();
const isMobile = ref(window.innerWidth <= 900);

// store → URL: when business logic (exam.startWrongPractice etc.) changes
// ui.currentTab, push the matching route so the URL stays in sync.
watch(() => ui.currentTab, (tab) => {
  const path = tab === 'subjects' ? '/' : `/${tab}`;
  if (route.path !== path) {
    router.push(path);
  }
});

const appClasses = computed(() => ({
  'sidebar-collapsed': ui.sidebarCollapsed && !isMobile.value,
  'sidebar-open': ui.sidebarOpen && isMobile.value
}));

function syncViewport() {
  isMobile.value = window.innerWidth <= 900;
  if (!isMobile.value) ui.sidebarOpen = false;
}

onMounted(() => {
  library.init();
  browse.init(library.snapshot().browseAnswerMode);
  exam.restoreSavedSession();
  window.addEventListener('resize', syncViewport);
});

onUnmounted(() => {
  window.removeEventListener('resize', syncViewport);
  exam.stopTimer();
});
</script>

<template>
  <div class="app" :class="appClasses">
    <SidebarNav :is-mobile="isMobile" />
    <main class="main-content">
      <div class="mobile-topbar">
        <button class="icon-toggle" type="button" @click="ui.toggleSidebar(isMobile)" aria-label="打开功能栏">
          ☰
        </button>
        <div class="mobile-topbar-meta">
          <span class="mobile-page-icon" aria-hidden="true"><TabIcon :name="ui.currentTabMeta.id" /></span>
          <div>
            <div class="mobile-topbar-title">{{ ui.currentTabMeta.label }}</div>
            <div class="mobile-topbar-subtitle">{{ ui.currentTabMeta.subtitle }}</div>
          </div>
        </div>
      </div>
      <RouterView v-slot="{ Component }">
        <Transition name="page-fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <div class="sidebar-overlay" @click="ui.closeSidebar()" />
    <MobileNav />
    <ToastHost />
    <ModalHost />
  </div>
</template>

<style scoped>
/* ── Mobile topbar icon ── */
.mobile-page-icon {
  font-size: 0;
}

/* ── Sidebar collapsed state (desktop) ── */
.sidebar-collapsed :deep(.sidebar) {
  width: var(--sidebar-collapsed-width);
  padding-inline: 8px;
  overflow: hidden;
}

.sidebar-collapsed :deep(.brand-text),
.sidebar-collapsed :deep(.nav-label),
.sidebar-collapsed :deep(.sidebar-footer) {
  display: none;
}

.sidebar-collapsed :deep(.sidebar-brand) {
  display: grid;
  height: 64px;
  place-items: center;
  gap: 4px;
  padding: 4px 0 6px;
}

.sidebar-collapsed :deep(.brand-icon) {
  width: 30px;
  height: 30px;
}

.sidebar-collapsed :deep(.sidebar-toggle) {
  min-width: 24px;
  min-height: 20px;
}

.sidebar-collapsed :deep(.nav-item) {
  justify-content: center;
  padding: 0;
  margin-left: 0;
  border-radius: var(--radius-lg);
}

.sidebar-collapsed :deep(.nav-icon) {
  flex-basis: 28px;
  width: 28px;
  height: 28px;
}

.icon-toggle {
  display: inline-grid;
  flex: 0 0 34px;
  width: 34px;
  height: 34px;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-soft);
  font-weight: var(--weight-bold);
  line-height: 1;
}

.icon-toggle:hover {
  background: var(--gray-75);
  border-color: var(--border-focus);
  color: var(--text);
}

/* ── Mobile (≤900px) ── */
@media (max-width: 900px) {
  .app {
    display: block;
  }

  .sidebar-open :deep(.sidebar) {
    transform: translateX(0);
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgba(20, 22, 30, 0.4);
    backdrop-filter: blur(2px);
  }

  .sidebar-open .sidebar-overlay {
    display: block;
  }

  .mobile-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    position: sticky;
    top: 8px;
    z-index: 20;
    min-height: 58px;
    margin-bottom: var(--space-3);
    padding: 10px 14px;
    border: 1px solid var(--border-soft);
    border-radius: var(--radius-xl);
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: var(--shadow-md);
  }

  .mobile-topbar-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }

  .mobile-page-icon {
    display: inline-grid;
    flex: 0 0 34px;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: var(--radius-md);
    background: var(--primary-light);
    color: var(--primary);
    font-weight: var(--weight-extrabold);
  }

  .mobile-page-icon :deep(.tab-icon-svg) {
    width: 18px;
    height: 18px;
  }

  .mobile-topbar-title,
  .mobile-topbar-subtitle {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .mobile-topbar-title {
    font-weight: var(--weight-extrabold);
    font-size: var(--text-card-title);
  }

  .mobile-topbar-subtitle {
    color: var(--text-muted);
    font-size: var(--text-caption);
  }
}

/* ── Desktop (≥901px) ── */
@media (min-width: 901px) {
  .mobile-topbar {
    display: none;
  }
}
</style>
