// 导航与侧边栏

let _pendingSwitchTab = null;
let _examLeaveConfirmed = false; // 用户已确认离开，不再重复提示

function showExamSwitchConfirm(targetTab) {
    const answered = Object.keys(currentExam.answers || {}).length;
    const total = currentExam.questions ? currentExam.questions.length : 0;
    _pendingSwitchTab = targetTab;
    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">⚠️ 答题进行中</h3>
        </div>
        <div class="modal-body">
            <p>你正在答题中，已答 <strong>${answered}</strong>/${total} 题。</p>
            <p>离开后考试计时将继续，你可以随时返回继续答题。</p>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal(); doExamSwitch()">离开页面</button>
            <button class="btn btn-primary" onclick="closeModal()">继续答题</button>
        </div>
    `);
}

function doExamSwitch() {
    if (!_pendingSwitchTab) return;
    const targetTab = _pendingSwitchTab;
    _pendingSwitchTab = null;
    _examLeaveConfirmed = true; // 标记已确认离开
    switchTab(targetTab);
}

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
        });
    });
}

function initSidebarState() {
    syncResponsiveLayout();
    updateMobileTopbar();
}

function toggleSidebar() {
    if (isMobileLayout()) {
        document.body.classList.toggle('sidebar-open');
        updateSidebarToggleUI();
        return;
    }

    const collapsed = !document.body.classList.contains('sidebar-collapsed');
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    setSavedSidebarCollapsed(collapsed);
    updateSidebarToggleUI();
}

function closeSidebarOnMobile() {
    if (!isMobileLayout()) return;
    document.body.classList.remove('sidebar-open');
    updateSidebarToggleUI();
}

function switchTab(tab) {
    if (tab === currentTab) {
        closeSidebarOnMobile();
        return;
    }
    // 只有未交卷的活跃考试才拦截切换；成绩页/已交卷状态不再提示
    if (!_examLeaveConfirmed && tab !== 'exam' && isExamInProgress()) {
        showExamSwitchConfirm(tab);
        return;
    }
    // 切到考试页时重置确认标记
    if (tab === 'exam') _examLeaveConfirmed = false;
    else closeAnswerCardOnMobile();

    if (tab !== 'browse') {
        mobileBrowseFiltersExpanded = false;
        updateMobileBrowseFilterState();
    }

    document.querySelectorAll('.nav-item').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));

    const navBtn = document.querySelector(`.nav-item[data-tab="${tab}"]`);
    if (navBtn) {
        navBtn.classList.add('active');
        navBtn.setAttribute('aria-selected', 'true');
    }

    const mobileNavBtn = document.querySelector(`.mobile-nav-item[data-tab="${tab}"]`);
    if (mobileNavBtn) mobileNavBtn.classList.add('active');

    const page = document.getElementById(`page-${tab}`);
    if (page) page.classList.add('active');
    currentTab = tab;

    if (tab === 'history') {
        requestAnimationFrame(() => showExamHistory());
    }
    if (tab === 'subjects') {
        renderSubjectCards();
    }
    if (tab === 'stats') {
        requestAnimationFrame(() => {
            updateStats();
            renderSubjectDist();
            requestAnimationFrame(() => drawPracticeChart(currentChartPeriod));
        });
    }
    if (tab === 'exam') {
        updateExamSubjectSelect();
        onExamSubjectChange();
    }

    updateMobileTopbar(tab);
    closeSidebarOnMobile();
}
