import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router';
import { type AppTab, useUiStore } from '@/stores/ui';
import { useExamStore } from '@/stores/exam';
import { useBrowseStore } from '@/stores/browse';
import { saveBrowseAnswerMode, saveSidebarCollapsed } from '@/services/storage';
import './tokens.css';
import './styles.css';

const app = createApp(App);
app.use(createPinia());
app.use(router);

// ---------------------------------------------------------------------------
// Auto-persist lightweight stores (library store handles its own via $subscribe)
// ---------------------------------------------------------------------------
const ui = useUiStore();
let uiTimer: ReturnType<typeof setTimeout> | null = null;
ui.$subscribe((_, state) => {
  if (uiTimer !== null) return;
  uiTimer = setTimeout(() => {
    uiTimer = null;
    saveSidebarCollapsed(state.sidebarCollapsed);
  }, 80);
}, { detached: true });

const browse = useBrowseStore();
let browseTimer: ReturnType<typeof setTimeout> | null = null;
browse.$subscribe((_, state) => {
  if (browseTimer !== null) return;
  browseTimer = setTimeout(() => {
    browseTimer = null;
    saveBrowseAnswerMode(state.answerMode);
  }, 80);
}, { detached: true });

// ---------------------------------------------------------------------------
// Navigation guard: sync route ↔ store, and block leaving an active exam
// ---------------------------------------------------------------------------
let pendingNavTarget: string | null = null;

router.beforeEach((to, from) => {
  const ui = useUiStore();

  // 1. URL → store: keep sidebar / mobile-nav highlight in sync
  const tab = to.meta.tab as AppTab | undefined;
  if (tab && ui.currentTab !== tab) {
    ui.currentTab = tab;
  }

  // 2. Exam guard: confirm before leaving an active exam session
  if (from.path === '/exam' && to.path !== '/exam') {
    const exam = useExamStore();
    if (exam.currentExam && !exam.currentExam.completed) {
      pendingNavTarget = to.fullPath;
      ui.showModal(
        '考试进行中',
        '当前有未完成的考试，离开将丢失考试进度。确定要离开吗？',
        [
          {
            label: '继续考试',
            style: 'secondary',
            action: () => { pendingNavTarget = null; },
          },
          {
            label: '离开考试',
            style: 'danger',
            action: () => {
              const target = pendingNavTarget;
              pendingNavTarget = null;
              exam.restart();          // clear exam state
              if (target) router.push(target);
            },
          },
        ]
      );
      return false; // cancel the navigation
    }
  }
});

app.mount('#app');
