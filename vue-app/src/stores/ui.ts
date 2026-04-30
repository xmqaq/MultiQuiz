import { defineStore } from 'pinia';
import type { ModalAction, ToastMessage } from '@/types';
import { genId } from '@/services/utils';
import { getSidebarCollapsed } from '@/services/storage';

export type AppTab = 'subjects' | 'import' | 'browse' | 'exam' | 'wrong' | 'history' | 'stats';

interface ModalState {
  open: boolean;
  title: string;
  message: string;
  html?: string;
  large: boolean;
  actions: ModalAction[];
}

export const tabs: Array<{ id: AppTab; label: string; subtitle: string }> = [
  { id: 'subjects', label: '题库中心', subtitle: '管理你的所有学科题库' },
  { id: 'import', label: '导入题库', subtitle: '填写学科名称并选择文件' },
  { id: 'browse', label: '题目浏览', subtitle: '浏览、搜索、标签和收藏' },
  { id: 'exam', label: '模拟答题', subtitle: '选择学科和参数开始练习' },
  { id: 'wrong', label: '错题本', subtitle: '集中复习答错题目' },
  { id: 'history', label: '考试记录', subtitle: '查看历次模拟考试成绩' },
  { id: 'stats', label: '统计分析', subtitle: '学习数据概览' }
];

export const useUiStore = defineStore('ui', {
  state: () => ({
    currentTab: 'subjects' as AppTab,
    toasts: [] as ToastMessage[],
    sidebarCollapsed: getSidebarCollapsed(),
    sidebarOpen: false,
    mobileBrowseFiltersOpen: false,
    modal: {
      open: false,
      title: '',
      message: '',
      html: '',
      large: false,
      actions: []
    } as ModalState
  }),
  getters: {
    currentTabMeta: state => tabs.find(tab => tab.id === state.currentTab) || tabs[0]
  },
  actions: {
    switchTab(tab: AppTab) {
      const changed = this.currentTab !== tab;
      this.currentTab = tab;
      this.sidebarOpen = false;
      if (tab !== 'browse') this.mobileBrowseFiltersOpen = false;
      if (changed && typeof window !== 'undefined') {
        window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
      }
    },
    toggleSidebar(isMobile: boolean) {
      if (isMobile) {
        this.sidebarOpen = !this.sidebarOpen;
        return;
      }
      this.sidebarCollapsed = !this.sidebarCollapsed;
    },
    closeSidebar() {
      this.sidebarOpen = false;
    },
    showToast(message: string, type: ToastMessage['type'] = 'info') {
      const id = genId();
      this.toasts.push({ id, message, type });
      window.setTimeout(() => this.dismissToast(id), 3000);
    },
    dismissToast(id: string) {
      this.toasts = this.toasts.filter(toast => toast.id !== id);
    },
    showModal(title: string, message: string, actions: ModalAction[] = [{ label: '知道了', action: () => {} }], large = false) {
      this.modal = { open: true, title, message, large, actions, html: '' };
    },
    showHtmlModal(title: string, html: string, actions: ModalAction[] = [{ label: '关闭', style: 'secondary', action: () => {} }], large = true) {
      this.modal = { open: true, title, message: '', html, large, actions };
    },
    closeModal() {
      this.modal.open = false;
      this.modal.actions = [];
      this.modal.html = '';
    },
    runModalAction(action: ModalAction) {
      this.closeModal();
      action.action();
    }
  }
});
