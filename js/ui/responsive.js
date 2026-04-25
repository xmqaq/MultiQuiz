// 响应式布局和移动端行为

function isMobileLayout() {
    return window.innerWidth <= 900;
}

function getSavedSidebarCollapsed() {
    return parseStorageJSON(SIDEBAR_COLLAPSE_KEY, false) === true;
}

function setSavedSidebarCollapsed(isCollapsed) {
    safeSetItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(Boolean(isCollapsed)));
}

function updateSidebarToggleUI() {
    const desktopToggle = document.getElementById('sidebarToggle');
    const desktopIcon = desktopToggle?.querySelector('.sidebar-toggle-icon');
    const mobileToggle = document.getElementById('mobileSidebarToggle');
    const mobileOpen = document.body.classList.contains('sidebar-open');
    const collapsed = document.body.classList.contains('sidebar-collapsed');

    if (desktopToggle && desktopIcon) {
        if (isMobileLayout()) {
            desktopIcon.textContent = '×';
            desktopToggle.setAttribute('aria-label', '关闭功能栏');
            desktopToggle.title = '关闭功能栏';
        } else {
            desktopIcon.textContent = collapsed ? '»' : '«';
            desktopToggle.setAttribute('aria-label', collapsed ? '展开侧边栏' : '收起侧边栏');
            desktopToggle.title = collapsed ? '展开侧边栏' : '收起侧边栏';
        }
    }

    if (mobileToggle) {
        const label = mobileOpen ? '关闭功能栏' : '打开功能栏';
        mobileToggle.setAttribute('aria-label', label);
        mobileToggle.title = label;
    }
}

function updateMobileTopbar(tab) {
    const titleEl = document.getElementById('mobileTopbarTitle');
    const subtitleEl = document.getElementById('mobileTopbarSubtitle');
    if (!titleEl || !subtitleEl) return;

    const page = tab ? document.getElementById(`page-${tab}`) : document.querySelector('.page.active');
    const currentPage = page || document.getElementById('page-subjects');
    const title = currentPage?.querySelector('.page-title')?.textContent?.trim() || '题库中心';
    const subtitle = currentPage?.querySelector('.page-subtitle')?.textContent?.trim() || '题库练习平台';

    titleEl.textContent = title;
    subtitleEl.textContent = subtitle;
}

function initMobileBrowseFilters() {
    updateMobileBrowseFilterState();
}

function getMobileBrowseFilterSummary() {
    const subjectLabel = document.getElementById('browseSubjectFilter')?.selectedOptions?.[0]?.textContent?.trim() || '全部学科';
    const tagValue = document.getElementById('browseTagFilter')?.value || 'all';
    const favoriteValue = document.getElementById('browseFavoriteFilter')?.value || 'all';

    const parts = [];
    if (subjectLabel && subjectLabel !== '全部学科') parts.push(subjectLabel);
    if (tagValue === 'untagged') parts.push('无标签');
    else if (tagValue !== 'all') parts.push(tagValue);
    if (favoriteValue === 'favorited') parts.push('仅收藏');
    else if (favoriteValue === 'unfavorited') parts.push('未收藏');

    return parts.length > 0 ? parts.join(' · ') : '全部题目';
}

function updateMobileBrowseFilterState() {
    const toggleBtn = document.getElementById('browseMobileFilterToggle');
    const filterGrid = document.getElementById('browseFilterGrid');
    const summary = document.getElementById('browseMobileFilterSummary');
    if (!toggleBtn || !filterGrid || !summary) return;

    const shouldExpand = !isMobileLayout() || mobileBrowseFiltersExpanded;
    filterGrid.classList.toggle('mobile-expanded', shouldExpand);
    toggleBtn.classList.toggle('active', shouldExpand && isMobileLayout());
    toggleBtn.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
    summary.textContent = getMobileBrowseFilterSummary();
}

function toggleMobileBrowseFilters(forceExpand) {
    if (!isMobileLayout()) return;
    mobileBrowseFiltersExpanded = typeof forceExpand === 'boolean' ? forceExpand : !mobileBrowseFiltersExpanded;
    updateMobileBrowseFilterState();
}

function syncResponsiveLayout() {
    if (isMobileLayout()) {
        document.body.classList.remove('sidebar-collapsed');
        closeAnswerCardOnMobile(false);
        updateMobileBrowseFilterState();
    } else {
        document.body.classList.remove('sidebar-open');
        closeAnswerCardOnMobile(false);
        document.body.classList.toggle('sidebar-collapsed', getSavedSidebarCollapsed());
        mobileBrowseFiltersExpanded = false;
        updateMobileBrowseFilterState();
    }
    updateSidebarToggleUI();
}

function closeAnswerCardOnMobile(updateToggle = true) {
    const panel = document.getElementById('answerCardPanel');
    const toggleBtn = document.getElementById('answerCardToggleBtn');

    document.body.classList.remove('answer-card-open');

    if (isMobileLayout()) {
        if (panel) panel.style.display = 'none';
    } else if (!updateToggle && panel) {
        panel.style.display = '';
    }

    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
}

function isExamCompleted() {
    return currentExam?.completed === true;
}

function updateExamInteractionState() {
    const panel = document.getElementById('answerCardPanel');
    const toggleBtn = document.getElementById('answerCardToggleBtn');
    const completed = isExamCompleted();

    if (completed) {
        if (panel) panel.style.display = 'none';
        document.body.classList.remove('answer-card-open');
    }

    if (toggleBtn) {
        toggleBtn.style.display = completed ? 'none' : '';
        toggleBtn.disabled = completed;
        toggleBtn.setAttribute('aria-expanded', 'false');
    }
}

function isExamInProgress() {
    const examContent = document.getElementById('examContent');
    const examNav = document.querySelector('.exam-nav');
    const hasQuestions = Array.isArray(currentExam?.questions) && currentExam.questions.length > 0;
    const examVisible = examContent && examContent.style.display !== 'none';
    const navVisible = examNav && getComputedStyle(examNav).display !== 'none';
    return Boolean(hasQuestions && examVisible && navVisible);
}

window.addEventListener('resize', () => {
    syncResponsiveLayout();
    updateMobileTopbar();
    if (document.getElementById('page-stats')?.classList.contains('active')) {
        setTimeout(() => {
            drawPracticeChart(currentChartPeriod);
            renderRadarChart();
            drawAccuracyChart();
        }, 100);
    }
});
