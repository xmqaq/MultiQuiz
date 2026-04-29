import { createRouter, createWebHistory } from 'vue-router';
import type { AppTab } from '@/stores/ui';

const routes = [
  {
    path: '/',
    name: 'subjects',
    component: () => import('@/components/pages/SubjectsPage.vue'),
    meta: { tab: 'subjects' as AppTab },
  },
  {
    path: '/import',
    name: 'import',
    component: () => import('@/components/pages/ImportPage.vue'),
    meta: { tab: 'import' as AppTab },
  },
  {
    path: '/browse',
    name: 'browse',
    component: () => import('@/components/pages/BrowsePage.vue'),
    meta: { tab: 'browse' as AppTab },
  },
  {
    path: '/exam',
    name: 'exam',
    component: () => import('@/components/pages/ExamPage.vue'),
    meta: { tab: 'exam' as AppTab },
  },
  {
    path: '/wrong',
    name: 'wrong',
    component: () => import('@/components/pages/WrongbookPage.vue'),
    meta: { tab: 'wrong' as AppTab },
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/components/pages/HistoryPage.vue'),
    meta: { tab: 'history' as AppTab },
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/components/pages/StatsPage.vue'),
    meta: { tab: 'stats' as AppTab },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0, left: 0, behavior: 'auto' };
  },
});

export default router;
