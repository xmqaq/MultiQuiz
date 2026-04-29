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
.mobile-page-icon {
  font-size: 0;
}

/* Sidebar collapse (desktop) */
.sidebar-collapsed {
  grid-template-columns: 88px 1fr;
}

.sidebar-collapsed :deep(.sidebar) {
  padding-inline: 12px;
}

.sidebar-collapsed :deep(.brand-text),
.sidebar-collapsed :deep(.nav-label),
.sidebar-collapsed :deep(.sidebar-footer) {
  display: none;
}

.sidebar-collapsed :deep(.nav-item) {
  justify-content: center;
}

.sidebar-collapsed :deep(.nav-icon) {
  flex-basis: 36px;
  width: 36px;
  height: 36px;
}

/* Mobile sidebar */
@media (max-width: 900px) {
  .app {
    display: block;
    padding-bottom: 72px;
  }

  .sidebar-open :deep(.sidebar) {
    transform: translateX(0);
  }

  .sidebar-overlay {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 30;
    background: rgba(15, 23, 42, 0.45);
  }

  .sidebar-open .sidebar-overlay {
    display: block;
  }

  .mobile-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
  }

  .mobile-topbar {
    position: sticky;
    top: 10px;
    z-index: 20;
    min-height: 68px;
    margin-bottom: 18px;
    padding: 10px 12px;
    box-shadow: var(--shadow-soft);
  }

  .mobile-topbar {
    border-radius: 12px;
  }

  .mobile-topbar {
    top: 8px;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(18px);
    border-color: rgba(205, 217, 232, 0.86);
    box-shadow: 0 12px 30px rgba(35, 55, 88, 0.08);
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
    border-radius: 8px;
    background: linear-gradient(135deg, #f0f5ff, #fff8ea);
    color: var(--primary);
    font-weight: 850;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.22);
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
    font-weight: 800;
  }

  .mobile-topbar-subtitle {
    color: var(--muted);
    font-size: 13px;
  }
}

@media (min-width: 901px) {
  .mobile-topbar {
    display: none;
  }
}
</style>
