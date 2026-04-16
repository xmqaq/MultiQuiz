// =============================================
// 数据模型
// subjects: [{ id, name, questions: [...] }]
// wrongQuestions: [{ ...question, subjectId, subjectName, userAnswer, timestamp }]
// practiceStats: { total, correct, practiced }
// examHistory: [{ id, date, score, ... subjectId, subjectName }]
// =============================================

let subjects = [];
let wrongQuestions = [];
let practiceStats = { total: 0, correct: 0, practiced: 0 };
let examHistory = [];
let currentExam = {};
let currentChartPeriod = '7';
let modalCallbacks = {}; // 用于存储模态框回调
let questionTags = {}; // 题目标签: { questionId: ['tag1', 'tag2'] }
let availableTags = ['重点', '易错', '已掌握', '需复习', '常考']; // 预设标签
let favoriteQuestionIds = [];
let favoriteSet = new Set();
let mobileBrowseFiltersExpanded = false;
let browseAnswerMode = 'show';
let revealedBrowseAnswers = new Set();
let currentTab = 'subjects';
const SIDEBAR_COLLAPSE_KEY = 'sidebarCollapsed';
const BROWSE_ANSWER_MODE_KEY = 'browseAnswerMode';

// =============================================
// 工具函数 - 安全存储
// =============================================

/**
 * HTML 转义函数，防止 XSS 攻击
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * 安全的 localStorage 存储，带容量检测
 */
function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            showToast('存储空间不足，请导出备份后清理部分数据', 'error');
        } else {
            showToast('数据保存失败：' + e.message, 'error');
        }
        return false;
    }
}

/**
 * 获取 localStorage 可用空间估算（字节）
 */
function getStorageAvailable() {
    let used = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            used += localStorage[key].length * 2; // UTF-16 编码
        }
    }
    return { used, limit: 5 * 1024 * 1024 }; // 假设 5MB 限制
}

// =============================================
// 初始化
// =============================================
document.addEventListener('DOMContentLoaded', () => {
    // 检测 XLSX 库是否加载成功
    if (typeof XLSX === 'undefined' || window.xlsxLoadFailed) {
        console.warn('XLSX 库加载失败，Excel 导入功能将不可用');
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.accept = '.json';
        }
        // 延迟显示提示，确保 toast 函数已可用
        setTimeout(() => {
            showToast('Excel 解析库加载失败，仅支持 JSON 文件导入', 'warning');
        }, 500);
    }

    loadData();
    initNavigation();
    initFileUpload();
    initSearch();
    initSidebarState();
    initMobileBrowseFilters();
    renderAll();
    restoreExamSession();
    updateMobileTopbar();
    syncResponsiveLayout();
});

function parseStorageJSON(key, fallbackValue) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.warn(`localStorage 数据损坏: ${key}`, e);
        showToast(`本地数据 ${key} 已损坏，已使用默认值`, 'warning');
        return fallbackValue;
    }
}

function loadData() {
    // 加载 subjects（新格式）
    const savedSubjects = localStorage.getItem('subjects');
    if (savedSubjects) {
        subjects = parseStorageJSON('subjects', []);
    } else {
        // 迁移旧数据：把旧的 questions[] 迁移为"网络安全"学科
        const oldQuestions = parseStorageJSON('questions', null);
        if (oldQuestions) {
            const qs = oldQuestions;
            if (qs && qs.length > 0) {
                subjects = [{
                    id: genId(),
                    name: '网络安全',
                    questions: qs
                }];
                saveSubjects();
                showToast(`已将原有 ${qs.length} 道题迁移至「网络安全」学科`, 'info');
            }
        }
    }

    wrongQuestions = parseStorageJSON('wrongQuestions', []);
    practiceStats = parseStorageJSON('practiceStats', { total: 0, correct: 0, practiced: 0 });
    examHistory = parseStorageJSON('examHistory', []);
    questionTags = parseStorageJSON('questionTags', {});
    favoriteQuestionIds = parseStorageJSON('favoriteQuestionIds', []);
    browseAnswerMode = parseStorageJSON(BROWSE_ANSWER_MODE_KEY, 'show') === 'hide' ? 'hide' : 'show';
    if (!Array.isArray(favoriteQuestionIds)) favoriteQuestionIds = [];
    favoriteSet = new Set(favoriteQuestionIds.map(id => String(id)));

    // 修复重复 id：遍历所有题目，发现重复 id 则重新生成
    const seenIds = new Set();
    let hasDuplicate = false;
    subjects.forEach(s => {
        s.questions.forEach(q => {
            if (!q.id || seenIds.has(q.id)) {
                q.id = genId();
                hasDuplicate = true;
            }
            seenIds.add(q.id);
        });
    });
    if (hasDuplicate) saveSubjects();
    cleanupOrphanFavorites();
}


function saveSubjects() {
    safeSetItem('subjects', JSON.stringify(subjects));
}

function renderAll() {
    cleanupOrphanFavorites();
    renderSubjectCards();
    updateSidebarStats();
    updateSubjectSelects();
    updateStats();
    updateBrowseAnswerModeButton();
    displayWrongQuestions();
    displayBrowseQuestions();
}

function questionIdKey(questionId) {
    return String(questionId);
}

function normalizeQuestionContent(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function buildQuestionContentKey(question) {
    return [
        normalizeQuestionContent(question.question),
        normalizeQuestionContent(question.optionA),
        normalizeQuestionContent(question.optionB),
        normalizeQuestionContent(question.optionC),
        normalizeQuestionContent(question.optionD),
        normalizeQuestionContent(question.answer).toUpperCase()
    ].join('||');
}

function collectLibraryDedupData() {
    const firstQuestionByContent = new Map();
    const duplicateTargets = new Map();
    const removedBySubject = new Map();

    subjects.forEach(subject => {
        subject.questions.forEach(question => {
            const contentKey = buildQuestionContentKey(question);
            const questionKey = questionIdKey(question.id);
            const first = firstQuestionByContent.get(contentKey);

            if (!first) {
                firstQuestionByContent.set(contentKey, {
                    id: questionKey,
                    subjectId: subject.id,
                    subjectName: subject.name
                });
                return;
            }

            duplicateTargets.set(questionKey, first);
            removedBySubject.set(subject.id, (removedBySubject.get(subject.id) || 0) + 1);
        });
    });

    return {
        duplicateCount: duplicateTargets.size,
        duplicateTargets,
        removedBySubject
    };
}

function resetExamStateAfterLibraryChange() {
    const hadRuntimeExam = Array.isArray(currentExam?.questions) && currentExam.questions.length > 0;
    const hadSavedExam = !!sessionStorage.getItem('currentExam');

    if (currentExam?.timer) clearTimeout(currentExam.timer);
    currentExam = {};
    _pendingSwitchTab = null;
    _examLeaveConfirmed = false;
    clearExamSession();

    const examSetup = document.getElementById('examSetup');
    const examContent = document.getElementById('examContent');
    const examNav = document.querySelector('.exam-nav');
    const timer = document.getElementById('timer');
    const answerCardPanel = document.getElementById('answerCardPanel');

    if (examSetup) examSetup.style.display = 'block';
    if (examContent) examContent.style.display = 'none';
    if (examNav) examNav.style.display = 'flex';
    if (answerCardPanel) answerCardPanel.style.display = 'none';
    if (timer) {
        timer.style.display = 'block';
        timer.style.color = '';
        timer.textContent = '60:00';
    }

    updateExamSubjectSelect();
    onExamSubjectChange();
    return hadRuntimeExam || hadSavedExam;
}

function saveFavorites() {
    favoriteQuestionIds = [...favoriteSet];
    safeSetItem('favoriteQuestionIds', JSON.stringify(favoriteQuestionIds));
}

function isFavorited(questionId) {
    return favoriteSet.has(questionIdKey(questionId));
}

function cleanupOrphanFavorites() {
    const allQuestionIds = new Set();
    subjects.forEach(s => s.questions.forEach(q => allQuestionIds.add(questionIdKey(q.id))));
    const before = favoriteSet.size;
    favoriteSet.forEach(id => {
        if (!allQuestionIds.has(id)) favoriteSet.delete(id);
    });
    if (favoriteSet.size !== before) {
        saveFavorites();
    } else if (favoriteQuestionIds.length !== favoriteSet.size) {
        // 规范化历史数据（如 number/string 混杂）
        saveFavorites();
    }
}

function favoriteButtonIcon(active) {
    if (active) {
        return `
            <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                <path d="M10 2.7l2.14 4.34 4.79.7-3.47 3.38.82 4.77L10 13.7l-4.28 2.19.82-4.77-3.47-3.38 4.79-.7L10 2.7Z" fill="currentColor"/>
            </svg>
        `;
    }
    return `
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M10 2.7l2.14 4.34 4.79.7-3.47 3.38.82 4.77L10 13.7l-4.28 2.19.82-4.77-3.47-3.38 4.79-.7L10 2.7Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </svg>
    `;
}

function tagButtonIcon() {
    return `
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M10.8 4H6.6a1.6 1.6 0 0 0-1.13.47L3.4 6.54A1.6 1.6 0 0 0 3.4 8.8l6.8 6.8a1.6 1.6 0 0 0 2.26 0l4.07-4.07a1.6 1.6 0 0 0 0-2.26l-3.47-3.47A2.6 2.6 0 0 0 10.8 4Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
            <circle cx="7.1" cy="7.1" r="1.05" fill="currentColor"/>
        </svg>
    `;
}

function applyFavoriteButtonState(btn, active) {
    if (!btn) return;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    btn.setAttribute('title', active ? '取消收藏' : '收藏题目');
    btn.setAttribute('aria-label', active ? '取消收藏' : '收藏题目');
    btn.innerHTML = favoriteButtonIcon(active);
}

function refreshFavoriteButtons(questionId) {
    const key = questionIdKey(questionId);
    const active = favoriteSet.has(key);
    document.querySelectorAll(`.fav-btn[data-fav-id="${CSS.escape(key)}"]`).forEach(btn => {
        applyFavoriteButtonState(btn, active);
    });
}

function toggleFavorite(questionId, evt) {
    if (evt) evt.stopPropagation();
    const key = questionIdKey(questionId);
    const had = favoriteSet.has(key);
    if (had) favoriteSet.delete(key);
    else favoriteSet.add(key);
    saveFavorites();
    refreshFavoriteButtons(key);

    // 答题中收藏时同步刷新答题卡
    const examContent = document.getElementById('examContent');
    if (examContent && examContent.style.display !== 'none') {
        updateAnswerCard();
    }

    const browsePage = document.getElementById('page-browse');
    if (browsePage?.classList.contains('active')) {
        const favoriteFilter = document.getElementById('browseFavoriteFilter')?.value || 'all';
        if (favoriteFilter !== 'all') displayBrowseQuestions();
    }
    showToast(had ? '已取消收藏' : '已收藏该题', had ? 'info' : 'success');
}

// =============================================
// 导航
// =============================================
// 答题中切换标签的确认弹窗
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

function isExamInProgress() {
    const examContent = document.getElementById('examContent');
    const examNav = document.querySelector('.exam-nav');
    const hasQuestions = Array.isArray(currentExam?.questions) && currentExam.questions.length > 0;
    const examVisible = examContent && examContent.style.display !== 'none';
    const navVisible = examNav && getComputedStyle(examNav).display !== 'none';
    return Boolean(hasQuestions && examVisible && navVisible);
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

// =============================================
// 题库中心 - 学科卡片
// =============================================
function renderSubjectCards() {
    const container = document.getElementById('subjectCards');
    const empty = document.getElementById('subjectEmptyState');

    // 先清掉现有卡片，再根据最新数据决定显示空状态还是重新渲染
    const existingCards = container.querySelectorAll('.subject-card');
    existingCards.forEach(c => c.remove());

    if (subjects.length === 0) {
        empty.style.display = 'flex';
        return;
    }
    empty.style.display = 'none';

    subjects.forEach(subject => {
        const wrongCount = wrongQuestions.filter(q => q.subjectId === subject.id).length;
        const total = subject.questions.length;
        const favoriteCount = subject.questions.filter(q => favoriteSet.has(questionIdKey(q.id))).length;
        const card = document.createElement('div');
        card.className = 'subject-card';
        card.innerHTML = `
            <div class="subject-card-top">
                <div class="subject-card-name">${escapeHtml(subject.name)}</div>
                <div class="subject-card-actions">
                    <button class="icon-btn subject-action-btn" title="管理题库" onclick="showSubjectCardActions('${subject.id}')">管理</button>
                </div>
            </div>
            <div class="subject-card-stats">
                <div class="sc-stat">
                    <div class="sc-stat-num">${total}</div>
                    <div class="sc-stat-label">题目</div>
                </div>
                <div class="sc-stat">
                    <div class="sc-stat-num sc-stat-num--wrong">${wrongCount}</div>
                    <div class="sc-stat-label">错题</div>
                </div>
                <div class="sc-stat">
                    <div class="sc-stat-num sc-stat-num--favorite">${favoriteCount}</div>
                    <div class="sc-stat-label">收藏</div>
                </div>
            </div>
            <div class="subject-card-btns">
                <button class="btn btn-sm btn-primary" onclick="quickExam('${subject.id}')">开始练习</button>
                <button class="btn btn-sm btn-ghost" onclick="browseSubject('${subject.id}')">浏览题目</button>
            </div>
        `;
        container.insertBefore(card, empty);
    });
}

function quickExam(subjectId) {
    switchTab('exam');
    setTimeout(() => {
        const sel = document.getElementById('examSubject');
        sel.value = subjectId;
        onExamSubjectChange();
    }, 50);
}

function browseSubject(subjectId) {
    switchTab('browse');
    setTimeout(() => {
        document.getElementById('browseSubjectFilter').value = subjectId;
        displayBrowseQuestions();
    }, 50);
}

function showSubjectActions() {
    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">题库管理</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom:16px;color:var(--text-secondary)">低频管理操作集中在这里，首页保留导入题库与导入配置入口。</p>
            <div class="modal-actions modal-actions-col">
                <button class="btn btn-secondary" onclick="closeModal(); showLibraryInfo()">查看题库信息</button>
                <button class="btn btn-secondary" onclick="closeModal(); exportAllBackup()">导出配置</button>
                <button class="btn btn-secondary" onclick="closeModal(); deduplicateLibrary()">题库去重</button>
                <button class="btn btn-danger" onclick="closeModal(); clearLibrary()">清空全部题库</button>
            </div>
        </div>
    `);
}

function showSubjectCardActions(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">${escapeHtml(subject.name)}</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p class="browse-actions-note">这里保留当前题库的管理操作，避免卡片顶部出现过多按钮。</p>
            <div class="modal-actions modal-actions-col">
                <button class="btn btn-secondary" onclick="closeModal(); renameSubject('${subject.id}')">编辑题库名</button>
                <button class="btn btn-secondary" onclick="closeModal(); exportSubject('${subject.id}')">导出当前题库</button>
                <button class="btn btn-danger" onclick="closeModal(); deleteSubject('${subject.id}')">删除当前题库</button>
            </div>
        </div>
    `);
}

function renameSubject(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    const newName = prompt(`重命名学科\n\n当前名称：${subject.name}`, subject.name);
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    if (trimmed === subject.name) { showToast('名称未改变', 'info'); return; }
    const exists = subjects.some(s => s.id !== subjectId && s.name === trimmed);
    if (exists) { showToast('该学科名称已存在', 'error'); return; }
    subject.name = trimmed;
    wrongQuestions.forEach(q => { if (q.subjectId === subjectId) q.subjectName = trimmed; });
    examHistory.forEach(r => { if (r.subjectId === subjectId) r.subjectName = trimmed; });
    saveSubjects();
    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
    safeSetItem('examHistory', JSON.stringify(examHistory));
    renderAll();
    showToast(`学科已改名为「${trimmed}」`, 'success');
}

function deleteSubject(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    showConfirmWithOptions(`确定删除「${escapeHtml(subject.name)}」题库？<br>将删除 ${subject.questions.length} 道题目，此操作不可恢复。`, [
        {
            label: '确认删除',
            danger: true,
            action: () => {
                const subjectQuestionIds = new Set(subject.questions.map(q => String(q.id)));

                // 扣减该学科在 practiceStats 中的贡献
                const subjectExamRecords = examHistory.filter(r => r.subjectId === subjectId);
                let subjectPracticed = 0, subjectCorrect = 0;
                subjectExamRecords.forEach(r => {
                    subjectPracticed += r.totalQuestions;
                    subjectCorrect += r.correct;
                });
                practiceStats.practiced = Math.max(0, practiceStats.practiced - subjectPracticed);
                practiceStats.correct = Math.max(0, practiceStats.correct - subjectCorrect);
                safeSetItem('practiceStats', JSON.stringify(practiceStats));

                subjects = subjects.filter(s => s.id !== subjectId);
                wrongQuestions = wrongQuestions.filter(q => q.subjectId !== subjectId);
                examHistory = examHistory.filter(r => r.subjectId !== subjectId);
                for (const qid of Object.keys(questionTags)) {
                    if (subjectQuestionIds.has(qid)) {
                        delete questionTags[qid];
                    }
                }
                favoriteSet.forEach(id => {
                    if (subjectQuestionIds.has(id)) favoriteSet.delete(id);
                });
                saveSubjects();
                safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
                safeSetItem('examHistory', JSON.stringify(examHistory));
                safeSetItem('questionTags', JSON.stringify(questionTags));
                saveFavorites();
                const hadExamSession = resetExamStateAfterLibraryChange();
                renderAll();
                showToast(`已删除「${subject.name}」题库${hadExamSession ? '，并清除了未完成考试缓存' : ''}`, 'success');
            }
        },
        { label: '取消', ghost: true, action: () => {} }
    ]);
}

function exportSubject(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    const config = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        subjectName: subject.name,
        totalQuestions: subject.questions.length,
        questions: subject.questions
    };
    downloadJson(config, `${subject.name}-题库-${today()}.json`);
    showToast(`「${subject.name}」题库已导出`, 'success');
}

function exportAllBackup() {
    const backup = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        exportDate: new Date().toLocaleString('zh-CN'),
        subjects: subjects,
        wrongQuestions: wrongQuestions,
        practiceStats: practiceStats,
        examHistory: examHistory,
        questionTags: questionTags,
        favoriteQuestionIds: [...favoriteSet]
    };
    downloadJson(backup, `多学科题库-完整备份-${today()}.json`);
    showToast('配置已备份导出，包含题库、错题本、标签、收藏、练习统计和考试记录', 'success');
}

function restoreFromBackup(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.onload = e => {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.version || backup.version !== '2.0') {
                showToast('备份文件格式不兼容', 'error');
                return;
            }
            showConfirmWithOptions('确定要导入备份配置？<br>将覆盖当前的所有题库、错题本和练习记录。', [
                {
                    label: '确认导入',
                    danger: true,
                    action: () => {
                        subjects = backup.subjects || [];
                        wrongQuestions = backup.wrongQuestions || [];
                        practiceStats = backup.practiceStats || { total: 0, correct: 0, practiced: 0 };
                        examHistory = backup.examHistory || [];
                        questionTags = (backup.questionTags && typeof backup.questionTags === 'object' && !Array.isArray(backup.questionTags))
                            ? backup.questionTags
                            : {};
                        favoriteQuestionIds = Array.isArray(backup.favoriteQuestionIds) ? backup.favoriteQuestionIds.map(id => String(id)) : [];
                        favoriteSet = new Set(favoriteQuestionIds);
                        saveSubjects();
                        safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
                        safeSetItem('practiceStats', JSON.stringify(practiceStats));
                        safeSetItem('examHistory', JSON.stringify(examHistory));
                        safeSetItem('questionTags', JSON.stringify(questionTags));
                        saveFavorites();
                        const hadExamSession = resetExamStateAfterLibraryChange();
                        renderAll();
                        showToast(`配置已恢复！包含 ${subjects.length} 个学科、${wrongQuestions.length} 条错题${hadExamSession ? '，并清除了未完成考试缓存' : ''}`, 'success');
                    }
                },
                { label: '取消', ghost: true, action: () => {} }
            ]);
        } catch (err) {
            showToast('备份文件解析失败：' + err.message, 'error');
        }
    };
    reader.readAsText(file, 'utf-8');
    fileInput.value = '';
}

// =============================================
// 导入题库
// =============================================
function initFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const fileInputDisplay = document.getElementById('fileInputDisplay');

    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) {
            fileInputDisplay.value = e.target.files[0].name;
        }
    });
}

function importSubject() {
    const subjectName = document.getElementById('subjectName').value.trim();
    const fileInput = document.getElementById('fileInput');

    if (!subjectName) {
        showToast('请填写学科名称', 'error');
        document.getElementById('subjectName').focus();
        return;
    }

    if (!fileInput.files[0]) {
        showToast('请选择题库文件', 'error');
        return;
    }

    const file = fileInput.files[0];
    const name = file.name.toLowerCase();

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        parseExcel(file, subjectName);
    } else if (name.endsWith('.json')) {
        parseJson(file, subjectName);
    } else {
        showToast('不支持的文件格式', 'error');
    }
}

function handleFile(file) {
    const subjectNameInput = document.getElementById('subjectName');
    const subjectName = subjectNameInput.value.trim();
    if (!subjectName) {
        showToast('请先填写学科名称', 'error');
        subjectNameInput.focus();
        return;
    }

    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
        parseJson(file, subjectName);
    } else if (name.match(/\.(xlsx|xls)$/)) {
        parseExcel(file, subjectName);
    } else {
        showToast('请选择 Excel (.xlsx/.xls) 或 JSON 文件', 'error');
    }
}

function downloadStaticFile(filePath, downloadName, successMessage) {
    const link = document.createElement('a');
    link.href = filePath;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(successMessage, 'success');
}

function downloadExcelTemplate() {
    downloadStaticFile('./templates/multiquiz-template.xlsx', 'MultiQuiz-Excel题库模板.xlsx', 'Excel 模板已下载');
}

function downloadJsonTemplate() {
    downloadStaticFile('./templates/multiquiz-template.json', 'MultiQuiz-JSON题库模板.json', 'JSON 模板已下载');
}

function parseExcel(file, subjectName) {
    showToast('正在读取文件...', 'info');
    const reader = new FileReader();
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.onload = e => {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            const parsed = parseExcelRows(rows);
            if (parsed.length === 0) { showToast('未找到有效题目，请检查 Excel 格式', 'error'); return; }
            importQuestions(parsed, subjectName);
        } catch (err) {
            showToast('文件解析失败：' + err.message, 'error');
        }
    };
    if (typeof reader.readAsArrayBuffer === 'function') {
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = e => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                importQuestions(parseExcelRows(rows), subjectName);
            } catch (err) { showToast('文件解析失败', 'error'); }
        };
        reader.readAsBinaryString(file);
    }
}

function parseExcelRows(rows) {
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 6 && row[0]) {
            const answer = (row[5] || '').toString().toUpperCase().trim();
            if (['A', 'B', 'C', 'D'].includes(answer)) {
                result.push({
                    id: genId(),
                    question: String(row[0] || ''),
                    optionA: String(row[1] || ''),
                    optionB: String(row[2] || ''),
                    optionC: String(row[3] || ''),
                    optionD: String(row[4] || ''),
                    answer
                });
            }
        }
    }
    return result;
}

function parseJson(file, subjectName) {
    showToast('正在读取配置文件...', 'info');
    const reader = new FileReader();
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.onload = e => {
        try {
            const config = JSON.parse(e.target.result);
            let rawQuestions = Array.isArray(config) ? config : (config.questions || []);
            const valid = rawQuestions.filter(q =>
                q.question && q.optionA && q.optionB && q.optionC && q.optionD &&
                ['A', 'B', 'C', 'D'].includes((q.answer || '').toString().toUpperCase())
            ).map(q => ({
                id: genId(),
                question: String(q.question),
                optionA: String(q.optionA),
                optionB: String(q.optionB),
                optionC: String(q.optionC),
                optionD: String(q.optionD),
                answer: q.answer.toString().toUpperCase().trim()
            }));
            if (valid.length === 0) { showToast('未找到格式正确的题目', 'error'); return; }
            importQuestions(valid, subjectName);
        } catch (err) {
            showToast('JSON 解析失败：' + err.message, 'error');
        }
    };
    reader.readAsText(file, 'utf-8');
}

function importQuestions(newQuestions, subjectName) {
    const existing = subjects.find(s => s.name === subjectName);
    if (existing) {
        showConfirmWithOptions(
            `学科「${subjectName}」已有 ${existing.questions.length} 道题目，新文件包含 ${newQuestions.length} 道题。`,
            [
                { label: `追加题目（共 ${existing.questions.length + newQuestions.length} 题）`, action: () => {
                    existing.questions = [...existing.questions, ...newQuestions];
                    saveSubjects();
                    afterImport(subjectName, newQuestions.length, existing.questions.length);
                }},
                { label: `覆盖题库（替换为 ${newQuestions.length} 题）`, action: () => {
                    existing.questions = newQuestions;
                    saveSubjects();
                    afterImport(subjectName, newQuestions.length, newQuestions.length);
                }},
                { label: '取消', danger: false, ghost: true, action: () => {} }
            ]
        );
    } else {
        subjects.push({ id: genId(), name: subjectName, questions: newQuestions });
        saveSubjects();
        afterImport(subjectName, newQuestions.length, newQuestions.length);
    }
}

function afterImport(subjectName, added, total) {
    renderAll();
    document.getElementById('subjectName').value = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInputDisplay').value = '未选择文件';
    showToast(`成功导入 ${added} 道题目到「${subjectName}」，共 ${total} 题`, 'success');
    switchTab('subjects');
}

// =============================================
// 题目浏览
// =============================================
function onBrowseFilterChange() {
    displayBrowseQuestions();
    updateMobileBrowseFilterState();
}

function updateBrowseAnswerModeButton() {
    const btn = document.getElementById('browseAnswerModeBtn');
    if (!btn) return;
    const hideMode = browseAnswerMode === 'hide';
    btn.textContent = hideMode ? '显示答案' : '隐藏答案';
    btn.classList.toggle('active', hideMode);
}

function toggleBrowseAnswerMode() {
    browseAnswerMode = browseAnswerMode === 'hide' ? 'show' : 'hide';
    if (browseAnswerMode === 'show') {
        revealedBrowseAnswers.clear();
    }
    safeSetItem(BROWSE_ANSWER_MODE_KEY, JSON.stringify(browseAnswerMode));
    updateBrowseAnswerModeButton();
    displayBrowseQuestions();
}

function toggleBrowseAnswerReveal(questionId) {
    const key = questionIdKey(questionId);
    if (revealedBrowseAnswers.has(key)) revealedBrowseAnswers.delete(key);
    else revealedBrowseAnswers.add(key);
    displayBrowseQuestions();
}

function showBrowseActions() {
    const { subject, questionCount } = getBrowseScopeInfo();
    const scopeTitle = subject ? `当前题库：${escapeHtml(subject.name)}` : '当前范围：全部题库';

    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">浏览页操作</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p class="browse-actions-note">${scopeTitle}，共 ${questionCount} 道题。这里仅保留当前范围导出操作，题库级管理已移至题库中心。</p>
            <div class="modal-actions modal-actions-col">
                <button class="btn btn-secondary" onclick="exportAsJSON()">导出当前题目为 JSON</button>
                <button class="btn btn-secondary" onclick="exportAsPDF()">导出当前题目为 PDF</button>
                <button class="btn btn-secondary" onclick="exportAsText()">导出当前题目为文本</button>
            </div>
        </div>
    `);
}

function displayBrowseQuestions(questionsToShow) {
    const container = document.getElementById('questionsList');
    const subjectFilter = document.getElementById('browseSubjectFilter')?.value || 'all';
    const tagFilter = document.getElementById('browseTagFilter')?.value || 'all';
    const favoriteFilter = document.getElementById('browseFavoriteFilter')?.value || 'all';
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';

    updateMobileBrowseFilterState();

    let pool = [];
    if (questionsToShow) {
        pool = questionsToShow;
    } else if (subjectFilter === 'all') {
        subjects.forEach(s => s.questions.forEach(q => pool.push({ ...q, _subjectId: s.id, _subjectName: s.name })));
    } else {
        const s = subjects.find(s => s.id === subjectFilter);
        if (s) pool = s.questions.map(q => ({ ...q, _subjectId: s.id, _subjectName: s.name }));
    }

    if (tagFilter !== 'all' && !questionsToShow) {
        if (tagFilter === 'untagged') {
            pool = pool.filter(q => !questionTags[q.id] || questionTags[q.id].length === 0);
        } else {
            pool = pool.filter(q => questionTags[q.id]?.includes(tagFilter));
        }
    }

    if (favoriteFilter === 'favorited') {
        pool = pool.filter(q => isFavorited(q.id));
    } else if (favoriteFilter === 'unfavorited') {
        pool = pool.filter(q => !isFavorited(q.id));
    }

    if (searchTerm) {
        pool = pool.filter(q =>
            [q.question, q.optionA, q.optionB, q.optionC, q.optionD]
                .some(v => v && v.toLowerCase().includes(searchTerm))
        );
    }

    updateTagFilterBar();

    if (pool.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">没有匹配的题目</div></div>`;
        return;
    }

    container.innerHTML = pool.map((q, i) => renderQuestionItem(q, i)).join('');
}

function renderQuestionTagsHtml(questionId) {
    const tags = questionTags[questionId] || [];
    if (tags.length === 0) return '';
    return `<div class="q-tags q-tags-inline">${tags.map(t => `<span class="q-tag tag-${t}">${escapeHtml(t)}</span>`).join('')}</div>`;
}

function renderQuestionItem(q, i) {
    const favored = isFavorited(q.id);
    const hideAnswer = browseAnswerMode === 'hide';
    const answerVisible = !hideAnswer || revealedBrowseAnswers.has(questionIdKey(q.id));
    const tagsHtml = renderQuestionTagsHtml(q.id);
    return `
        <div class="q-item" data-id="${q.id}">
            <div class="q-item-header">
                <div class="q-item-meta">
                    <span class="q-num">${i + 1}</span>
                    <span class="q-subject-tag">${escapeHtml(q._subjectName || '')}</span>
                </div>
                <div class="q-item-actions">
                    <button class="icon-btn fav-btn ${favored ? 'active' : ''}" data-fav-id="${escapeHtml(String(q.id))}" onclick='toggleFavorite(${JSON.stringify(q.id)}, event)' title="${favored ? '取消收藏' : '收藏题目'}" aria-label="${favored ? '取消收藏' : '收藏题目'}" aria-pressed="${favored ? 'true' : 'false'}">${favoriteButtonIcon(favored)}</button>
                    <button class="icon-btn q-tag-action-btn" onclick='showTagEditor(${JSON.stringify(q.id)})' title="编辑标签" aria-label="编辑标签">${tagButtonIcon()}</button>
                </div>
            </div>
            <div class="q-text-wrap">
                <div class="q-text">${escapeHtml(q.question)}</div>
            </div>
            ${tagsHtml}
            <div class="q-options">
                ${['A', 'B', 'C', 'D'].map(opt => `
                    <div class="q-opt">
                        <span class="q-opt-letter">${opt}</span>
                        <span class="q-opt-body">${escapeHtml(q['option' + opt])}</span>
                    </div>
                `).join('')}
            </div>
            <div class="q-answer ${answerVisible ? '' : 'collapsed'}">
                ${answerVisible
                    ? `<span class="q-answer-main"><span class="q-answer-label">正确答案</span><span class="q-answer-pill">${q.answer}</span></span>${hideAnswer ? `<button class="btn btn-sm btn-ghost q-answer-toggle" onclick='toggleBrowseAnswerReveal(${JSON.stringify(q.id)})'>收起答案</button>` : ''}`
                    : `<button class="btn btn-sm btn-secondary q-answer-toggle" onclick='toggleBrowseAnswerReveal(${JSON.stringify(q.id)})'>显示答案</button>`
                }
            </div>
        </div>
    `;
}

// 标签筛选栏
function updateTagFilterBar() {
    const bar = document.getElementById('tagFilterBar');
    const sel = document.getElementById('browseTagFilter');
    if (!bar && !sel) return;

    // 收集所有使用的标签
    const usedTags = new Set();
    Object.values(questionTags).forEach(tags => {
        tags.forEach(t => usedTags.add(t));
    });

    // 同步更新下拉框选项
    if (sel) {
        const curVal = sel.value;
        sel.innerHTML = '<option value="all">全部标签</option><option value="untagged">无标签</option>';
        [...usedTags].forEach(tag => {
            const opt = document.createElement('option');
            opt.value = tag;
            opt.textContent = tag;
            sel.appendChild(opt);
        });
        // 恢复当前选中值（如果仍存在）
        if ([...sel.options].some(o => o.value === curVal)) {
            sel.value = curVal;
        }
    }

    updateMobileBrowseFilterState();

    // 更新标签按钮栏
    if (!bar) return;
    if (usedTags.size === 0) {
        bar.innerHTML = '';
        return;
    }

    const curTag = sel ? sel.value : 'all';
    bar.innerHTML = `
        <span style="font-size:12px;color:var(--text-muted)">标签筛选：</span>
        ${[...usedTags].map(tag => `
            <button class="tag-chip ${curTag === tag ? 'active' : ''}" onclick='filterByTag(${JSON.stringify(tag)}, event)'>${tag}</button>
        `).join('')}
        <button class="tag-chip" onclick="filterByTag('', event)">清除</button>
    `;
}

function filterByTag(tag, evt) {
    document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
    if (tag) {
        if (evt && evt.target) evt.target.classList.add('active');
        document.getElementById('browseTagFilter').value = tag;
    } else {
        document.getElementById('browseTagFilter').value = 'all';
    }
    displayBrowseQuestions();
}

// 标签编辑器
function showTagEditor(questionId) {
    const currentTags = questionTags[questionId] || [];

    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">🏷️ 编辑标签</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom:12px;font-size:14px;color:var(--text-secondary)">点击标签可添加/移除：</p>
            <div class="tag-editor">
                ${availableTags.map(tag => `
                    <button class="tag-editor-item ${currentTags.includes(tag) ? 'active' : ''}"
                            onclick='toggleQuestionTag(${JSON.stringify(questionId)}, ${JSON.stringify(tag)}, event)'>
                        ${currentTags.includes(tag) ? '✓ ' : ''}${tag}
                    </button>
                `).join('')}
            </div>
            <div style="margin-top:16px">
                <input type="text" id="newTagInput" class="form-input" placeholder="添加新标签..." style="width:200px">
                <button class="btn btn-sm btn-primary" onclick="addNewTag('${questionId}')" style="margin-left:8px">添加</button>
            </div>
        </div>
    `);
}

function toggleQuestionTag(questionId, tag, evt) {
    if (!questionTags[questionId]) {
        questionTags[questionId] = [];
    }

    const idx = questionTags[questionId].indexOf(tag);
    if (idx === -1) {
        questionTags[questionId].push(tag);
    } else {
        questionTags[questionId].splice(idx, 1);
    }

    safeSetItem('questionTags', JSON.stringify(questionTags));

    // 刷新弹窗内按钮状态
    const btn = evt?.target;
    const isNowActive = idx === -1;
    if (btn) {
        btn.classList.toggle('active', isNowActive);
        btn.textContent = (isNowActive ? '✓ ' : '') + tag;
    }

    // 只更新这一道题目的标签显示，不重渲染整个列表
    const qItem = document.querySelector(`.q-item[data-id="${CSS.escape(questionId)}"]`);
    if (qItem) {
        const tagsDiv = qItem.querySelector('.q-tags');
        const textWrap = qItem.querySelector('.q-text-wrap');
        const html = renderQuestionTagsHtml(questionId);
        if (html) {
            if (tagsDiv) {
                tagsDiv.outerHTML = html;
            } else if (textWrap) {
                textWrap.insertAdjacentHTML('afterend', html);
            }
        } else if (tagsDiv) {
            tagsDiv.remove();
        }
    }

    // 同步更新下拉框和标签筛选栏（不触发列表重渲染）
    updateTagFilterBar();
}

function addNewTag(questionId) {
    const input = document.getElementById('newTagInput');
    const tag = input.value.trim();

    if (!tag) return;

    if (!availableTags.includes(tag)) {
        availableTags.push(tag);
    }

    if (!questionTags[questionId]) {
        questionTags[questionId] = [];
    }

    if (!questionTags[questionId].includes(tag)) {
        questionTags[questionId].push(tag);
        safeSetItem('questionTags', JSON.stringify(questionTags));
    }

    input.value = '';
    showTagEditor(questionId); // 刷新弹窗
}

let browseSearchTimer = null;

function initSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;

    input.addEventListener('input', () => {
        window.clearTimeout(browseSearchTimer);
        browseSearchTimer = window.setTimeout(() => {
            displayBrowseQuestions();
        }, 120);
    });

    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            e.preventDefault();
            window.clearTimeout(browseSearchTimer);
            displayBrowseQuestions();
        }
        if (e.key === 'Escape') {
            input.value = '';
            window.clearTimeout(browseSearchTimer);
            displayBrowseQuestions();
        }
    });
}

function showLibraryInfo() {
    const total = subjects.reduce((n, s) => n + s.questions.length, 0);
    const rows = subjects.map(s => `
        <div class="library-info-row">
            <div class="library-info-name">${escapeHtml(s.name)}</div>
            <div class="library-info-count">${s.questions.length}</div>
        </div>
    `).join('');

    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">题库信息</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body library-info-body">
            <div class="library-info-summary">
                <div class="library-info-summary-item">
                    <div class="library-info-summary-value">${subjects.length}</div>
                    <div class="library-info-summary-label">学科数</div>
                </div>
                <div class="library-info-summary-item">
                    <div class="library-info-summary-value">${total}</div>
                    <div class="library-info-summary-label">总题数</div>
                </div>
            </div>
            <div class="library-info-list">
                <div class="library-info-list-head">
                    <span>学科</span>
                    <span>题目数</span>
                </div>
                <div class="library-info-list-body">
                    ${rows}
                </div>
            </div>
        </div>
        <div class="modal-actions"><button class="btn btn-primary" onclick="closeModal()">知道了</button></div>
    `);
}

function exportQuestions() {
    if (subjects.length === 0) { showToast('题库为空', 'error'); return; }
    const subjectFilter = document.getElementById('browseSubjectFilter')?.value || 'all';
    if (subjectFilter !== 'all') {
        exportSubject(subjectFilter);
    } else {
        const all = { version: '2.0', timestamp: new Date().toISOString(), subjects };
        downloadJson(all, `全部题库-${today()}.json`);
        showToast('全部题库已导出', 'success');
    }
}

function getBrowseScopeInfo() {
    const subjectFilter = document.getElementById('browseSubjectFilter')?.value || 'all';
    const subject = subjectFilter === 'all' ? null : subjects.find(s => s.id === subjectFilter) || null;
    const questionCount = subject
        ? subject.questions.length
        : subjects.reduce((n, s) => n + s.questions.length, 0);
    return { subjectFilter, subject, questionCount };
}

// 导出选项
function showExportOptions() {
    const { subject, questionCount } = getBrowseScopeInfo();

    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">导出题库</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom:16px;color:var(--text-secondary)">
                ${subject ? `当前学科：${subject.name}` : '全部学科'}，共 ${questionCount} 道题目
            </p>
            <div style="display:flex;flex-direction:column;gap:10px">
                <button class="btn btn-secondary" onclick="exportAsJSON()" style="justify-content:center">
                    📄 导出为 JSON
                </button>
                <button class="btn btn-secondary" onclick="exportAsPDF()" style="justify-content:center">
                    📑 导出为 PDF（打印）
                </button>
                <button class="btn btn-secondary" onclick="exportAsText()" style="justify-content:center">
                    📝 导出为文本
                </button>
            </div>
        </div>
    `);
}

function exportAsJSON() {
    closeModal();
    exportQuestions();
}

function exportAsPDF() {
    closeModal();
    // 创建打印专用视图
    const subjectFilter = document.getElementById('browseSubjectFilter')?.value || 'all';
    let pool = [];

    if (subjectFilter === 'all') {
        subjects.forEach(s => s.questions.forEach(q => pool.push({ ...q, _subjectName: s.name })));
    } else {
        const s = subjects.find(s => s.id === subjectFilter);
        if (s) pool = s.questions.map(q => ({ ...q, _subjectName: s.name }));
    }

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>题库导出 - ${today()}</title>
            <style>
                body { font-family: 'SimSun', serif; padding: 40px; line-height: 1.8; }
                h1 { text-align: center; margin-bottom: 30px; }
                .question { margin-bottom: 24px; page-break-inside: avoid; }
                .q-title { font-weight: bold; margin-bottom: 8px; }
                .q-option { margin-left: 20px; }
                .q-answer { margin-top: 8px; color: #666; font-size: 14px; }
                .subject-tag { color: #999; font-size: 12px; margin-left: 10px; }
                @media print { body { padding: 20px; } }
            </style>
        </head>
        <body>
            <h1>题库导出 (${pool.length}题)</h1>
            ${pool.map((q, i) => `
                <div class="question">
                    <div class="q-title">${i + 1}. ${escapeHtml(q.question)}<span class="subject-tag">[${q._subjectName || ''}]</span></div>
                    <div class="q-option">A. ${escapeHtml(q.optionA)}</div>
                    <div class="q-option">B. ${escapeHtml(q.optionB)}</div>
                    <div class="q-option">C. ${escapeHtml(q.optionC)}</div>
                    <div class="q-option">D. ${escapeHtml(q.optionD)}</div>
                    <div class="q-answer">答案：${q.answer}</div>
                </div>
            `).join('')}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.print();
}

function exportAsText() {
    closeModal();
    const subjectFilter = document.getElementById('browseSubjectFilter')?.value || 'all';
    let pool = [];

    if (subjectFilter === 'all') {
        subjects.forEach(s => s.questions.forEach(q => pool.push({ ...q, _subjectName: s.name })));
    } else {
        const s = subjects.find(s => s.id === subjectFilter);
        if (s) pool = s.questions.map(q => ({ ...q, _subjectName: s.name }));
    }

    const text = pool.map((q, i) => {
        return `${i + 1}. ${q.question}
A. ${q.optionA}
B. ${q.optionB}
C. ${q.optionC}
D. ${q.optionD}
答案：${q.answer}
`;
    }).join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `题库-${today()}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('已导出为文本文件', 'success');
}

function clearLibrary() {
    const subjectFilter = document.getElementById('browseSubjectFilter')?.value || 'all';
    if (subjectFilter === 'all') {
        if (subjects.length === 0) { showToast('题库已为空', 'info'); return; }
        const totalCount = subjects.reduce((n,s)=>n+s.questions.length,0);
        showConfirmWithOptions(`确定清空全部题库？<br>共 ${totalCount} 道题目将被删除。`, [
            {
                label: '清空全部',
                danger: true,
                action: () => {
                    subjects = [];
                    wrongQuestions = [];
                    examHistory = [];
                    questionTags = {};
                    favoriteSet = new Set();
                    practiceStats = { total: 0, correct: 0, practiced: 0 };
                    saveSubjects();
                    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
                    safeSetItem('examHistory', JSON.stringify(examHistory));
                    safeSetItem('questionTags', JSON.stringify(questionTags));
                    safeSetItem('practiceStats', JSON.stringify(practiceStats));
                    saveFavorites();
                    const hadExamSession = resetExamStateAfterLibraryChange();
                    renderAll();
                    showToast(`全部题库及相关练习数据已清空${hadExamSession ? '，并清除了未完成考试缓存' : ''}`, 'success');
                }
            },
            { label: '取消', ghost: true, action: () => {} }
        ]);
    } else {
        deleteSubject(subjectFilter);
    }
}

function deduplicateLibrary() {
    const totalCount = subjects.reduce((sum, subject) => sum + subject.questions.length, 0);
    if (totalCount === 0) {
        showToast('当前还没有题目可去重', 'info');
        return;
    }

    const preview = collectLibraryDedupData();
    if (preview.duplicateCount === 0) {
        showToast('当前题库没有检测到重复内容', 'success');
        return;
    }

    const affectedSubjects = subjects
        .map(subject => ({ name: subject.name, count: preview.removedBySubject.get(subject.id) || 0 }))
        .filter(item => item.count > 0);

    const summaryHtml = affectedSubjects
        .slice(0, 6)
        .map(item => `- ${escapeHtml(item.name)}：${item.count} 道重复题`)
        .join('<br>');

    const extraSummary = affectedSubjects.length > 6
        ? `<br>... 其余 ${affectedSubjects.length - 6} 个学科也检测到重复题`
        : '';

    showConfirmWithOptions(
        `检测到 <strong>${preview.duplicateCount}</strong> 道重复题。<br>去重规则：按“题干 + 四个选项 + 答案”完全一致判断，保留第一次出现的题目。<br>不同学科中的完全相同题目也会合并到首次出现的学科。${summaryHtml ? `<br><br>${summaryHtml}${extraSummary}` : ''}<br><br>去重时会同步合并标签、收藏和错题记录，并清除未完成考试缓存。`,
        [
            {
                label: '开始去重',
                danger: true,
                action: () => {
                    const { duplicateCount, duplicateTargets } = collectLibraryDedupData();
                    if (duplicateCount === 0) {
                        showToast('当前题库没有检测到重复内容', 'info');
                        return;
                    }

                    subjects.forEach(subject => {
                        subject.questions = subject.questions.filter(question => !duplicateTargets.has(questionIdKey(question.id)));
                    });

                    const validQuestionIds = new Set();
                    subjects.forEach(subject => {
                        subject.questions.forEach(question => validQuestionIds.add(questionIdKey(question.id)));
                    });

                    const nextQuestionTags = {};
                    Object.entries(questionTags || {}).forEach(([questionId, tags]) => {
                        const target = duplicateTargets.get(questionIdKey(questionId));
                        const targetId = target ? questionIdKey(target.id) : questionIdKey(questionId);
                        if (!validQuestionIds.has(targetId)) return;

                        const mergedTags = new Set(nextQuestionTags[targetId] || []);
                        (tags || []).forEach(tag => {
                            if (tag) mergedTags.add(tag);
                        });
                        if (mergedTags.size > 0) nextQuestionTags[targetId] = [...mergedTags];
                    });
                    questionTags = nextQuestionTags;

                    const nextFavorites = new Set();
                    favoriteSet.forEach(questionId => {
                        const target = duplicateTargets.get(questionIdKey(questionId));
                        const targetId = target ? questionIdKey(target.id) : questionIdKey(questionId);
                        if (validQuestionIds.has(targetId)) nextFavorites.add(targetId);
                    });
                    favoriteSet = nextFavorites;

                    const latestWrongByQuestion = new Map();
                    wrongQuestions.forEach(record => {
                        const sourceId = questionIdKey(record.id);
                        const target = duplicateTargets.get(sourceId);
                        const targetId = target ? questionIdKey(target.id) : sourceId;
                        if (!validQuestionIds.has(targetId)) return;

                        const normalizedRecord = {
                            ...record,
                            id: targetId,
                            subjectId: target?.subjectId || record.subjectId,
                            subjectName: target?.subjectName || record.subjectName
                        };

                        const prev = latestWrongByQuestion.get(targetId);
                        const prevTime = prev ? new Date(prev.timestamp || 0).getTime() : -Infinity;
                        const currTime = new Date(normalizedRecord.timestamp || 0).getTime();
                        if (!prev || currTime >= prevTime) {
                            latestWrongByQuestion.set(targetId, normalizedRecord);
                        }
                    });
                    wrongQuestions = [...latestWrongByQuestion.values()];

                    const hadExamSession = resetExamStateAfterLibraryChange();

                    saveSubjects();
                    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
                    safeSetItem('questionTags', JSON.stringify(questionTags));
                    saveFavorites();
                    renderAll();

                    showToast(`已去重 ${duplicateCount} 道重复题${hadExamSession ? '，并清除了未完成考试缓存' : ''}`, 'success');
                }
            },
            { label: '取消', ghost: true, action: () => {} }
        ]
    );
}

// =============================================
// 模拟答题
// =============================================
function updateExamSubjectSelect() {
    const sel = document.getElementById('examSubject');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="all">全部学科</option>';
    subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        sel.appendChild(opt);
    });
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function onExamSubjectChange() {
    const sel = document.getElementById('examSubject');
    const hint = document.getElementById('examSubjectHint');
    if (!sel || !hint) return;
    const val = sel.value;
    let count = 0;
    if (val === 'all') {
        count = subjects.reduce((n, s) => n + s.questions.length, 0);
    } else {
        const s = subjects.find(s => s.id === val);
        count = s ? s.questions.length : 0;
    }
    hint.textContent = `共 ${count} 道题`;
}

function startExam() {
    closeAnswerCardOnMobile(false);
    const subjectVal = document.getElementById('examSubject').value;
    const examCount = document.getElementById('examCount').value;
    const examTime = parseInt(document.getElementById('examTime').value);

    // 智能推题选项
    const smartWrongFirst = document.getElementById('smartWrongFirst')?.checked || false;
    const smartWeighted = document.getElementById('smartWeighted')?.checked || false;
    const smartTagged = document.getElementById('smartTagged')?.checked || false;
    const examFavoritesOnly = document.getElementById('examFavoritesOnly')?.checked || false;

    let pool = [];
    let subjectName = '全部学科';
    if (subjectVal === 'all') {
        subjects.forEach(s => s.questions.forEach(q => pool.push({ ...q, _subjectId: s.id, _subjectName: s.name })));
    } else {
        const s = subjects.find(s => s.id === subjectVal);
        if (!s) { showToast('请先导入题库', 'error'); return; }
        pool = s.questions.map(q => ({ ...q, _subjectId: s.id, _subjectName: s.name }));
        subjectName = s.name;
    }

    if (examFavoritesOnly) {
        pool = pool.filter(q => isFavorited(q.id));
        subjectName += ' · 收藏题';
    }

    if (pool.length === 0) {
        if (examFavoritesOnly) showToast('当前范围内没有收藏题目，请先标星后再练习', 'warning');
        else showToast('该学科暂无题目，请先导入', 'error');
        return;
    }

    // 智能推题处理
    let examQuestions;
    if (smartWrongFirst || smartWeighted || smartTagged) {
        examQuestions = smartSelectQuestions(pool, examCount === 'all' ? pool.length : parseInt(examCount), {
            wrongFirst: smartWrongFirst,
            weighted: smartWeighted,
            tagged: smartTagged
        });
    } else {
        examQuestions = shuffleArray(pool);
        if (examCount !== 'all') {
            const n = parseInt(examCount);
            if (n > pool.length) {
                showToast(`题库只有 ${pool.length} 道题，已自动调整为全部题目`, 'warning');
            } else {
                examQuestions = examQuestions.slice(0, n);
            }
        }
    }

    currentExam = {
        questions: examQuestions,
        currentIndex: 0,
        answers: {},
        startTime: new Date(),
        effectiveStart: new Date(),
        timeLimit: examTime,
        timer: null,
        subjectId: subjectVal,
        subjectName,
        isWrongPractice: false,
        timeLeft: examTime * 60,
        endTime: Date.now() + examTime * 60 * 1000
    };

    saveExamSession();

    document.getElementById('examSetup').style.display = 'none';
    document.getElementById('examContent').style.display = 'block';
    document.getElementById('totalQuestions').textContent = examQuestions.length;
    document.getElementById('examSubjectTag').textContent = subjectName;
    document.getElementById('timer').style.display = 'block';
    document.getElementById('timer').style.color = '';

    startTimer();
    showQuestion();
}

// 智能推题算法
function smartSelectQuestions(pool, count, options) {
    const { wrongFirst, weighted, tagged } = options;

    // 计算每道题的权重
    const weightedPool = pool.map(q => {
        let weight = 1;

        // 错题权重提高
        if (wrongFirst && wrongQuestions.some(w => w.id === q.id)) {
            weight += 5;
        }

        // 标记为"需复习"的题目权重提高
        if (tagged && questionTags[q.id]?.includes('需复习')) {
            weight += 3;
        }

        // 加权抽题：根据正确率调整
        if (weighted) {
            // 根据错题次数降低权重（错得越多，权重越高，越容易被抽到）
            const wrongCount = wrongQuestions.filter(w => w.id === q.id).length;
            weight += wrongCount * 2;
        }

        return { ...q, weight };
    });

    // 按权重排序（高权重在前）
    weightedPool.sort((a, b) => b.weight - a.weight);

    // 加权随机抽取
    const selected = [];
    const remaining = [...weightedPool];
    const targetCount = Math.min(count, pool.length);

    while (selected.length < targetCount && remaining.length > 0) {
        // 计算总权重
        const totalWeight = remaining.reduce((sum, q) => sum + q.weight, 0);

        // 随机选择（权重越高，概率越大）
        let rand = Math.random() * totalWeight;
        let selectedIdx = 0;

        for (let i = 0; i < remaining.length; i++) {
            rand -= remaining[i].weight;
            if (rand <= 0) {
                selectedIdx = i;
                break;
            }
        }

        selected.push(remaining[selectedIdx]);
        remaining.splice(selectedIdx, 1);
    }

    // 打乱顺序
    return shuffleArray(selected);
}

function startTimer() {
    // 使用绝对结束时间，确保刷新/关闭页面后恢复时仍按真实时间流逝计时
    if (!currentExam.endTime) {
        const totalSeconds = currentExam.timeLeft ?? currentExam.timeLimit * 60;
        currentExam.endTime = Date.now() + totalSeconds * 1000;
    }

    function updateTimer() {
        const remaining = Math.max(0, Math.floor((currentExam.endTime - Date.now()) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        document.getElementById('timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if (remaining <= 300) document.getElementById('timer').style.color = '#ef4444';

        if (remaining <= 0) {
            submitExam();
            return;
        }

        currentExam.timeLeft = remaining;
        if (remaining % 10 === 0) saveExamSession();
        currentExam.timer = setTimeout(updateTimer, 1000);
    }

    updateTimer();
}

function showQuestion() {
    const q = currentExam.questions[currentExam.currentIndex];
    const favored = isFavorited(q.id);
    document.getElementById('currentQuestion').textContent = currentExam.currentIndex + 1;

    const selectedAns = currentExam.answers[q.id];
    document.getElementById('questionContent').innerHTML = `
        <div class="q-card-top">
            <span class="q-card-index">${currentExam.currentIndex + 1}</span>
            <span class="q-card-subject">${escapeHtml(q._subjectName || currentExam.subjectName)}</span>
            <button class="icon-btn fav-btn q-card-fav ${favored ? 'active' : ''}" data-fav-id="${escapeHtml(String(q.id))}" onclick='toggleFavorite(${JSON.stringify(q.id)}, event)' title="${favored ? '取消收藏' : '收藏题目'}" aria-label="${favored ? '取消收藏' : '收藏题目'}" aria-pressed="${favored ? 'true' : 'false'}">${favoriteButtonIcon(favored)}</button>
        </div>
        <div class="q-exam-text">${escapeHtml(q.question)}</div>
        <div class="q-exam-options">
            ${['A','B','C','D'].map(opt => `
                <label class="q-exam-opt ${selectedAns === opt ? 'selected' : ''}">
                    <input type="radio" name="ans" value="${opt}" ${selectedAns === opt ? 'checked' : ''}>
                    <span class="opt-letter">${opt}</span>
                    <span class="opt-text">${escapeHtml(q['option' + opt])}</span>
                </label>
            `).join('')}
        </div>
    `;

    document.querySelectorAll('.q-exam-opt').forEach(label => {
        label.addEventListener('click', () => {
            const radio = label.querySelector('input');
            radio.checked = true;
            document.querySelectorAll('.q-exam-opt').forEach(l => l.classList.remove('selected'));
            label.classList.add('selected');
            currentExam.answers[q.id] = radio.value;
            saveExamSession();
            updateAnswerCard();
        });
    });

    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = ((currentExam.currentIndex + 1) / currentExam.questions.length * 100) + '%';
    
    updateAnswerCard();
}

// 答题卡
function toggleAnswerCard(forceOpen) {
    const panel = document.getElementById('answerCardPanel');
    const toggleBtn = document.getElementById('answerCardToggleBtn');
    if (!panel) return;

    const isHidden = panel.style.display === 'none' || getComputedStyle(panel).display === 'none';
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;

    if (shouldOpen) {
        panel.style.display = 'block';
        updateAnswerCard();
        if (isMobileLayout()) document.body.classList.add('answer-card-open');
    } else {
        panel.style.display = 'none';
        document.body.classList.remove('answer-card-open');
    }

    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function updateAnswerCard() {
    const grid = document.getElementById('answerCardGrid');
    if (!grid || !currentExam.questions) return;

    grid.innerHTML = currentExam.questions.map((q, i) => {
        const isAnswered = currentExam.answers[q.id] !== undefined;
        const isCurrent = i === currentExam.currentIndex;
        const favored = isFavorited(q.id);
        return `
            <button class="answer-card-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''} ${favored ? 'favored' : ''}" onclick="jumpToQuestion(${i})" title="${favored ? '已收藏 - 点击跳转' : (i + 1)}">
                ${i + 1}
                ${favored ? '<span class="fav-star">★</span>' : ''}
            </button>
        `;
    }).join('');
}

function jumpToQuestion(index) {
    if (index >= 0 && index < currentExam.questions.length) {
        currentExam.currentIndex = index;
        showQuestion();
        saveExamSession();
        if (isMobileLayout()) closeAnswerCardOnMobile();
    }
}

function prevQuestion() {
    if (currentExam.currentIndex > 0) { currentExam.currentIndex--; showQuestion(); saveExamSession(); }
}
function nextQuestion() {
    if (currentExam.currentIndex < currentExam.questions.length - 1) { currentExam.currentIndex++; showQuestion(); saveExamSession(); }
}

function submitExam() {
    if (currentExam.timer) clearTimeout(currentExam.timer);
    closeAnswerCardOnMobile(false);
    clearExamSession();
    const newWrong = [];
    const corrected = [];
    let correct = 0;

    currentExam.questions.forEach(q => {
        const ua = currentExam.answers[q.id];
        if (ua === q.answer) {
            correct++;
            if (currentExam.isWrongPractice) corrected.push(q.id);
        } else {
            if (!currentExam.isWrongPractice) {
                newWrong.push({
                    ...q,
                    subjectId: q._subjectId || currentExam.subjectId,
                    subjectName: q._subjectName || currentExam.subjectName,
                    userAnswer: ua || '未作答',
                    timestamp: new Date().toISOString()
                });
            }
        }
    });

    if (currentExam.isWrongPractice) {
        wrongQuestions = wrongQuestions.filter(q => !corrected.includes(q.id));
    } else {
        // 答对的题从错题本移除
        const answeredCorrectIds = new Set(
            currentExam.questions
                .filter(q => currentExam.answers[q.id] === q.answer)
                .map(q => q.id)
        );
        wrongQuestions = wrongQuestions.filter(q => !answeredCorrectIds.has(q.id));
        // 答错的题：去重后追加（保持最新一次）
        const newWrongIds = new Set(newWrong.map(q => q.id));
        wrongQuestions = wrongQuestions.filter(q => !newWrongIds.has(q.id));
        wrongQuestions = [...wrongQuestions, ...newWrong];
    }
    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));

    practiceStats.practiced += currentExam.questions.length;
    practiceStats.correct += correct;
    safeSetItem('practiceStats', JSON.stringify(practiceStats));

    const score = Math.round(correct / currentExam.questions.length * 100);
    const duration = Math.round((new Date() - (currentExam.effectiveStart || currentExam.startTime)) / 1000 / 60);

    if (!currentExam.isWrongPractice) {
        const record = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            score, correct,
            totalQuestions: currentExam.questions.length,
            duration,
            timeLimit: currentExam.timeLimit,
            wrongCount: newWrong.length,
            subjectId: currentExam.subjectId,
            subjectName: currentExam.subjectName,
            questions: currentExam.questions.map(q => ({
                id: q.id,
                question: q.question,
                optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
                correctAnswer: q.answer,
                userAnswer: currentExam.answers[q.id] || '未作答'
            }))
        };
        examHistory.unshift(record);
        if (examHistory.length > 50) examHistory = examHistory.slice(0, 50);
        safeSetItem('examHistory', JSON.stringify(examHistory));
    }

    updateStats();
    displayWrongQuestions();

    const scoreColor = score >= 60 ? '#10b981' : '#ef4444';
    const isPass = score >= 60;

    if (currentExam.isWrongPractice) {
        document.getElementById('questionContent').innerHTML = `
            <div class="result-panel">
                <div class="result-icon">${score >= 80 ? '🎉' : '📚'}</div>
                <div class="result-score" style="color:${scoreColor}">${score}分</div>
                <div class="result-title">错题练习完成</div>
                <div class="result-details">
                    <div class="result-stat"><span>${currentExam.questions.length}</span>练习题目</div>
                    <div class="result-stat"><span>${correct}</span>答对</div>
                    <div class="result-stat"><span>${corrected.length}</span>已掌握</div>
                    <div class="result-stat"><span>${currentExam.questions.length - correct}</span>仍需练习</div>
                </div>
                <div class="result-btns">
                    <button class="btn btn-primary" onclick="startWrongQuestionsPractice()">继续练习</button>
                    <button class="btn btn-ghost" onclick="restartExam()">返回设置</button>
                </div>
            </div>
        `;
    } else {
        document.getElementById('questionContent').innerHTML = `
            <div class="result-panel">
                <div class="result-icon">${isPass ? '🎉' : '💪'}</div>
                <div class="result-score" style="color:${scoreColor}">${score}分</div>
                <div class="result-title">${isPass ? '恭喜通过！' : '继续加油！'}</div>
                <div class="result-details">
                    <div class="result-stat"><span>${correct}/${currentExam.questions.length}</span>正确题数</div>
                    <div class="result-stat"><span>${duration}</span>分钟用时</div>
                    <div class="result-stat"><span>${newWrong.length}</span>错题数</div>
                </div>
                <div class="result-btns">
                    <button class="btn btn-primary" onclick="restartExam()">再考一次</button>
                    ${newWrong.length > 0 ? '<button class="btn btn-warning" onclick="startWrongQuestionsPractice()">练习错题</button>' : ''}
                    <button class="btn btn-ghost" onclick="switchTab(\'history\')">查看记录</button>
                </div>
            </div>
        `;
    }
    document.querySelector('.exam-nav').style.display = 'none';
}

function restartExam() {
    closeAnswerCardOnMobile(false);
    clearExamSession();
    document.getElementById('examSetup').style.display = 'block';
    document.getElementById('examContent').style.display = 'none';
    document.querySelector('.exam-nav').style.display = 'flex';
    document.getElementById('timer').style.color = '';
    updateExamSubjectSelect();
    onExamSubjectChange();
}

function saveExamSession() {
    if (!currentExam || !currentExam.questions) return;
    const session = {
        questions: currentExam.questions,
        currentIndex: currentExam.currentIndex,
        answers: currentExam.answers,
        startTime: currentExam.startTime,
        effectiveStart: currentExam.effectiveStart,
        timeLimit: currentExam.timeLimit,
        timeLeft: currentExam.timeLeft,
        endTime: currentExam.endTime || null,
        savedAt: Date.now(),
        subjectId: currentExam.subjectId,
        subjectName: currentExam.subjectName,
        isWrongPractice: currentExam.isWrongPractice
    };
    sessionStorage.setItem('currentExam', JSON.stringify(session));
}

function clearExamSession() {
    sessionStorage.removeItem('currentExam');
}

function restoreExamSession() {
    const saved = sessionStorage.getItem('currentExam');
    if (!saved) return;
    try {
        const session = JSON.parse(saved);
        if (!session.questions || session.questions.length === 0) { clearExamSession(); return; }

        // 检查考试时间是否已过期（非错题练习）
        if (!session.isWrongPractice) {
            let remainingSeconds = null;
            const now = Date.now();

            if (typeof session.endTime === 'number') {
                remainingSeconds = Math.max(0, Math.floor((session.endTime - now) / 1000));
            } else if (session.timeLeft !== undefined) {
                const elapsedSinceSave = typeof session.savedAt === 'number'
                    ? Math.max(0, Math.floor((now - session.savedAt) / 1000))
                    : 0;
                remainingSeconds = Math.max(0, Number(session.timeLeft) - elapsedSinceSave);
                session.endTime = now + remainingSeconds * 1000;
            }

            if (remainingSeconds !== null) {
                session.timeLeft = remainingSeconds;
            }

            if (session.timeLeft !== undefined && session.timeLeft <= 0) {
                clearExamSession();
                showToast('上次考试时间已用完，已自动清除', 'info');
                return;
            }
        }

        showConfirmWithOptions('检测到上次未完成的考试，是否继续？', [
            {
                label: '继续答题',
                action: () => {
                    currentExam = {
                        ...session,
                        timer: null,
                        startTime: new Date(session.startTime),
                        effectiveStart: new Date()
                    };
                    closeAnswerCardOnMobile(false);
                    switchTab('exam');
                    document.getElementById('examSetup').style.display = 'none';
                    document.getElementById('examContent').style.display = 'block';
                    document.getElementById('totalQuestions').textContent = currentExam.questions.length;
                    document.getElementById('examSubjectTag').textContent = currentExam.subjectName;
                    if (currentExam.isWrongPractice) {
                        document.getElementById('timer').style.display = 'none';
                    } else {
                        document.getElementById('timer').style.display = 'block';
                        startTimer();
                    }
                    showQuestion();
                }
            },
            { label: '放弃考试', danger: true, action: () => { clearExamSession(); } }
        ]);
    } catch (e) {
        clearExamSession();
    }
}

// =============================================
// 错题本
// =============================================
function displayWrongQuestions(filterSubjectId) {
    const container = document.getElementById('wrongQuestions');
    const desc = document.getElementById('wrongCountDesc');
    const filterSel = document.getElementById('wrongSubjectFilter');

    const fid = filterSubjectId || (filterSel ? filterSel.value : 'all');
    let pool = fid === 'all' ? wrongQuestions : wrongQuestions.filter(q => q.subjectId === fid);

    desc.textContent = `共 ${wrongQuestions.length} 道错题`;
    if (wrongQuestions.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">暂无错题</div><div class="empty-desc">完成模拟答题后，错题会自动记录在这里</div></div>`;
        return;
    }
    if (pool.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><div class="empty-title">该学科暂无错题</div></div>`;
        return;
    }

    container.innerHTML = pool.map((q, i) => `
        <div class="wrong-item">
            <div class="wrong-item-header">
                <span class="wrong-num">${i + 1}</span>
                <span class="subject-tag">${q.subjectName || ''}</span>
                <span class="wrong-time">${new Date(q.timestamp).toLocaleString('zh-CN')}</span>
            </div>
            <div class="wrong-text">${escapeHtml(q.question)}</div>
            <div class="wrong-options">
                ${['A','B','C','D'].map(opt => `
                    <div class="wrong-opt ${q.answer===opt?'correct-opt':''} ${q.userAnswer===opt&&q.userAnswer!==q.answer?'wrong-opt-item':''}">
                        ${opt}. ${escapeHtml(q['option' + opt])}
                    </div>
                `).join('')}
            </div>
            <div class="wrong-ans-row">
                <span class="wrong-ans-badge my-ans">你的答案：${escapeHtml(q.userAnswer)}</span>
                <span class="wrong-ans-badge right-ans">正确答案：${escapeHtml(q.answer)}</span>
            </div>
        </div>
    `).join('');
}

function filterWrongQuestions() {
    const val = document.getElementById('wrongSubjectFilter').value;
    displayWrongQuestions(val);
}

function clearWrongQuestions() {
    if (wrongQuestions.length === 0) { showToast('错题本已为空', 'info'); return; }
    showConfirmWithOptions('确定清空所有错题？此操作不可恢复。', [
        {
            label: '清空错题',
            danger: true,
            action: () => {
                wrongQuestions = [];
                safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
                displayWrongQuestions();
                updateStats();
                showToast('错题本已清空', 'success');
            }
        },
        { label: '取消', ghost: true, action: () => {} }
    ]);
}

function startWrongQuestionsPractice() {
    if (wrongQuestions.length === 0) { showToast('错题本为空', 'warning'); return; }

    closeAnswerCardOnMobile(false);

    const filterValue = document.getElementById('wrongSubjectFilter')?.value || 'all';
    const practicePool = filterValue === 'all'
        ? wrongQuestions
        : wrongQuestions.filter(q => q.subjectId === filterValue);

    if (practicePool.length === 0) {
        showToast('当前筛选学科下暂无错题可练习', 'info');
        return;
    }

    const subjectName = filterValue === 'all'
        ? '错题练习'
        : `${subjects.find(s => s.id === filterValue)?.name || '当前学科'}错题练习`;

    currentExam = {
        questions: shuffleArray(practicePool),
        currentIndex: 0,
        answers: {},
        startTime: new Date(),
        effectiveStart: new Date(),
        timeLimit: 999,
        timeLeft: 999 * 60,
        timer: null,
        subjectId: filterValue === 'all' ? 'wrong-all' : filterValue,
        subjectName,
        isWrongPractice: true
    };

    switchTab('exam');
    setTimeout(() => {
        document.getElementById('examSetup').style.display = 'none';
        document.getElementById('examContent').style.display = 'block';
        document.getElementById('totalQuestions').textContent = currentExam.questions.length;
        document.getElementById('examSubjectTag').textContent = subjectName;
        document.getElementById('timer').style.display = 'none';
        document.querySelector('.exam-nav').style.display = 'flex';
        showQuestion();
    }, 50);
}

// =============================================
// 考试记录
// =============================================
function showExamHistory() {
    const container = document.getElementById('historyList');
    if (examHistory.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">暂无考试记录</div></div>`;
        return;
    }
    container.innerHTML = examHistory.map(r => {
        const d = new Date(r.date);
        const dateStr = d.toLocaleDateString('zh-CN', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
        const isPass = r.score >= 60;
        return `
            <div class="history-item">
                <div class="history-score ${isPass?'pass':'fail'}">${r.score}分</div>
                <div class="history-info-block">
                    <div class="history-item-top">
                        <span class="history-subject-tag">${r.subjectName || '全部学科'}</span>
                        <span class="history-date">${dateStr}</span>
                    </div>
                    <div class="history-stats">
                        <div class="hs-item"><div class="hs-v">${r.correct}/${r.totalQuestions}</div><div class="hs-l">正确率</div></div>
                        <div class="hs-item"><div class="hs-v">${r.wrongCount}</div><div class="hs-l">错题数</div></div>
                        <div class="hs-item"><div class="hs-v">${r.duration}min</div><div class="hs-l">用时</div></div>
                        <div class="hs-item"><div class="hs-v ${isPass?'text-green':'text-red'}">${isPass?'通过':'未通过'}</div><div class="hs-l">状态</div></div>
                    </div>
                </div>
                <div class="history-actions">
                    <button class="btn btn-sm btn-primary" onclick="viewExamDetail('${r.id}')">查看详情</button>
                    <button class="btn btn-sm btn-ghost" onclick="retakeExam('${r.id}')">重做此卷</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteExamRecord('${r.id}')">删除</button>
                </div>
            </div>
        `;
    }).join('');
}

function viewExamDetail(recordId) {
    const r = examHistory.find(r => r.id === recordId);
    if (!r) return;
    const questionsHtml = r.questions.map((q, i) => {
        const isCorrect = q.userAnswer === q.correctAnswer;
        const statusClass = q.userAnswer === '未作答' ? 'unanswered' : (isCorrect ? 'correct' : 'wrong');
        return `
            <div class="detail-q ${statusClass}">
                <div class="detail-q-text">${i+1}. ${escapeHtml(q.question)}</div>
                <div class="detail-q-opts">
                    ${['A','B','C','D'].map(opt => `
                        <div class="detail-opt ${q.correctAnswer===opt?'is-correct':''} ${q.userAnswer===opt&&q.userAnswer!==q.correctAnswer?'is-wrong':''}">
                            ${opt}. ${escapeHtml(q['option' + opt])}
                        </div>
                    `).join('')}
                </div>
                <div class="detail-q-ans">正确答案：${escapeHtml(q.correctAnswer)} | 你的答案：${escapeHtml(q.userAnswer)}</div>
            </div>
        `;
    }).join('');

    showModal(`
        <div class="detail-header">
            <h3 class="modal-title">考试详情 — ${r.subjectName || ''}</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="detail-summary">
            <div class="ds-item"><div class="ds-v">${r.score}分</div><div class="ds-l">得分</div></div>
            <div class="ds-item"><div class="ds-v">${r.correct}/${r.totalQuestions}</div><div class="ds-l">正确</div></div>
            <div class="ds-item"><div class="ds-v">${r.duration}min</div><div class="ds-l">用时</div></div>
        </div>
        <div class="detail-questions">${questionsHtml}</div>
    `, true);
}

function retakeExam(recordId) {
    const r = examHistory.find(r => r.id === recordId);
    if (!r) return;
    const examQuestions = r.questions.map(q => ({
        id: q.id,
        question: q.question,
        optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
        answer: q.correctAnswer,
        _subjectId: r.subjectId,
        _subjectName: r.subjectName
    }));
    const timeLimit = r.timeLimit || Math.max(30, Math.ceil(examQuestions.length / 30) * 30);
    closeAnswerCardOnMobile(false);
    currentExam = {
        questions: examQuestions,
        currentIndex: 0,
        answers: {},
        startTime: new Date(),
        effectiveStart: new Date(),
        timeLimit,
        timeLeft: timeLimit * 60,
        timer: null,
        subjectId: r.subjectId,
        subjectName: r.subjectName,
        isWrongPractice: false
    };
    switchTab('exam');
    setTimeout(() => {
        document.getElementById('examSetup').style.display = 'none';
        document.getElementById('examContent').style.display = 'block';
        document.getElementById('totalQuestions').textContent = examQuestions.length;
        document.getElementById('examSubjectTag').textContent = r.subjectName || '';
        document.getElementById('timer').style.display = 'block';
        document.querySelector('.exam-nav').style.display = 'flex';
        startTimer();
        showQuestion();
    }, 50);
}

function rollbackPracticeStatsByRecords(records) {
    if (!Array.isArray(records) || records.length === 0) return;

    let practicedToRollback = 0;
    let correctToRollback = 0;

    records.forEach(record => {
        practicedToRollback += Number(record?.totalQuestions) || 0;
        correctToRollback += Number(record?.correct) || 0;
    });

    practiceStats.practiced = Math.max(0, (practiceStats.practiced || 0) - practicedToRollback);
    practiceStats.correct = Math.max(0, (practiceStats.correct || 0) - correctToRollback);
    safeSetItem('practiceStats', JSON.stringify(practiceStats));
}

function deleteExamRecord(recordId) {
    showConfirmWithOptions('确定删除这条考试记录？', [
        {
            label: '删除记录',
            danger: true,
            action: () => {
                const removedRecords = examHistory.filter(r => r.id === recordId);
                if (removedRecords.length === 0) return;
                rollbackPracticeStatsByRecords(removedRecords);
                examHistory = examHistory.filter(r => r.id !== recordId);
                safeSetItem('examHistory', JSON.stringify(examHistory));
                showExamHistory();
                updateStats();
                showToast('记录已删除，统计已同步更新', 'success');
            }
        },
        { label: '取消', ghost: true, action: () => {} }
    ]);
}

function exportHistory() {
    if (examHistory.length === 0) { showToast('暂无记录', 'warning'); return; }
    downloadJson({ exportDate: new Date().toISOString(), records: examHistory }, `考试记录-${today()}.json`);
    showToast('考试记录已导出', 'success');
}

function clearHistory() {
    if (examHistory.length === 0) { showToast('暂无记录', 'info'); return; }
    showConfirmWithOptions(`确定清空全部 ${examHistory.length} 条考试记录？`, [
        {
            label: '清空记录',
            danger: true,
            action: () => {
                rollbackPracticeStatsByRecords(examHistory);
                examHistory = [];
                safeSetItem('examHistory', JSON.stringify(examHistory));
                showExamHistory();
                updateStats();
                showToast('考试记录已清空，统计已同步更新', 'success');
            }
        },
        { label: '取消', ghost: true, action: () => {} }
    ]);
}

// =============================================
// 统计分析
// =============================================
function updateStats() {
    const total = subjects.reduce((n, s) => n + s.questions.length, 0);
    document.getElementById('totalQuestionsCount').textContent = total;
    document.getElementById('practicedCount').textContent = practiceStats.practiced || 0;
    document.getElementById('wrongCount').textContent = wrongQuestions.length;
    const acc = practiceStats.practiced > 0 ? Math.round(practiceStats.correct / practiceStats.practiced * 100) : 0;
    document.getElementById('accuracyRate').textContent = acc + '%';
    updateSidebarStats();
}

function updateSidebarStats() {
    document.getElementById('sidebarSubjectCount').textContent = subjects.length;
    document.getElementById('sidebarTotalCount').textContent = subjects.reduce((n, s) => n + s.questions.length, 0);
}

function renderSubjectDist() {
    const container = document.getElementById('subjectDistribution');
    if (!container) return;
    if (subjects.length === 0) { container.innerHTML = '<div class="empty-state" style="padding:20px">暂无数据</div>'; return; }
    const total = subjects.reduce((n, s) => n + s.questions.length, 0);
    const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16'];
    container.innerHTML = subjects.map((s, i) => {
        const pct = total > 0 ? Math.round(s.questions.length / total * 100) : 0;
        return `
            <div class="dist-item">
                <div class="dist-name">
                    <span class="dist-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[i%colors.length]};margin-right:6px;flex-shrink:0;"></span>${s.name}
                </div>
                <div class="dist-bar-wrap">
                    <div class="dist-bar" style="width:${pct}%;background:${colors[i%colors.length]}"></div>
                </div>
                <div class="dist-num">${s.questions.length} 题 (${pct}%)</div>
            </div>
        `;
    }).join('');

    // 同时渲染雷达图
    renderRadarChart();
    // 渲染热力图
    renderHeatmap();
    // 渲染正确率趋势图
    drawAccuracyChart();
}

// 学习热力图
function renderHeatmap() {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;

    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 364);

    // 计算每日练习数量
    const dailyData = {};
    examHistory.forEach(r => {
        const d = new Date(r.date).toLocaleDateString('zh-CN');
        dailyData[d] = (dailyData[d] || 0) + r.totalQuestions;
    });

    // 生成热力图
    let html = '';
    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const key = d.toLocaleDateString('zh-CN');
        const count = dailyData[key] || 0;
        let color = '#ebedf0';
        if (count > 0) color = '#9be9a8';
        if (count > 10) color = '#40c463';
        if (count > 30) color = '#30a14e';
        if (count > 50) color = '#216e39';

        html += `<span class="heatmap-cell" style="background:${color}" title="${key}: ${count}题"></span>`;
    }
    container.innerHTML = html;
}

// 学科雷达图
function renderRadarChart() {
    const canvas = document.getElementById('radarChart');
    if (!canvas || subjects.length === 0) return;

    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const W = rect.width, H = rect.height;
    const cx = W / 2, cy = H / 2;
    const radius = Math.min(W, H) / 2 - 50;

    // 计算每个学科的正确率
    const subjectAccuracy = subjects.map(s => {
        const subjectWrong = wrongQuestions.filter(q => q.subjectId === s.id).length;
        const practiced = practiceStats.practiced || 1;
        // 简化计算：基于错题数估算
        const accuracy = Math.max(0, Math.min(100, 100 - (subjectWrong / Math.max(s.questions.length, 1)) * 100));
        return { name: s.name, accuracy: Math.round(accuracy) };
    });

    if (subjectAccuracy.length < 3) {
        canvas.style.display = 'none';
        const container = canvas.parentElement;
        const oldHint = container.querySelector('.radar-hint');
        if (!oldHint) {
            const hint = document.createElement('div');
            hint.className = 'radar-hint chart-empty';
            hint.innerHTML = '<div>📊</div><div>需要至少3个学科才能显示雷达图</div>';
            container.appendChild(hint);
        }
        return;
    }
    canvas.style.display = 'block';
    const existingHint = canvas.parentElement.querySelector('.radar-hint');
    if (existingHint) existingHint.remove();

    const n = subjectAccuracy.length;
    const angleStep = (Math.PI * 2) / n;

    ctx.clearRect(0, 0, W, H);

    // 绘制背景网格
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let level = 1; level <= 5; level++) {
        const r = (radius / 5) * level;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
            const angle = angleStep * i - Math.PI / 2;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // 绘制轴线和标签
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    subjectAccuracy.forEach((s, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * (radius + 25);
        const y = cy + Math.sin(angle) * (radius + 25);

        // 轴线
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        ctx.stroke();

        // 标签
        ctx.fillText(s.name, x, y);
    });

    // 绘制数据多边形
    ctx.beginPath();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.3)';
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    subjectAccuracy.forEach((s, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const r = (s.accuracy / 100) * radius;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 绘制数据点
    ctx.fillStyle = '#6366f1';
    subjectAccuracy.forEach((s, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const r = (s.accuracy / 100) * radius;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });
}

// 正确率趋势图
function drawAccuracyChart() {
    const canvas = document.getElementById('accuracyChart');
    const noData = document.getElementById('accuracyChartNoData');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const data = getAccuracyTrendData();

    if (data.length < 2) {
        canvas.style.display = 'none';
        if (noData) noData.style.display = 'flex';
        return;
    }
    canvas.style.display = 'block';
    if (noData) noData.style.display = 'none';

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);

    const W = rect.width, H = rect.height;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);

    // 绘制网格
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = pad.top + (cH / 5) * i;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(pad.left + cW, y);
        ctx.stroke();
    }

    // Y轴标签
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
        ctx.fillText((100 - i * 20) + '%', pad.left - 8, pad.top + (cH / 5) * i);
    }

    const stepX = cW / Math.max(data.length - 1, 1);

    // 绘制折线
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    data.forEach((p, i) => {
        const x = pad.left + stepX * i;
        const y = pad.top + cH - (p.accuracy / 100) * cH;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 绘制数据点
    ctx.fillStyle = '#10b981';
    data.forEach((p, i) => {
        const x = pad.left + stepX * i;
        const y = pad.top + cH - (p.accuracy / 100) * cH;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // X轴标签
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    data.forEach((p, i) => {
        if (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) {
            ctx.fillText(p.label, pad.left + stepX * i, pad.top + cH + 8);
        }
    });
}

function getAccuracyTrendData() {
    // 按考试记录计算每次考试的正确率
    return examHistory.slice(0, 30).reverse().map(r => ({
        date: r.date,
        label: new Date(r.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
        accuracy: Math.round((r.correct / r.totalQuestions) * 100)
    }));
}

// =============================================
// 图表
// =============================================
function getPracticeData(period) {
    const now = new Date();
    const data = {};
    examHistory.forEach(r => {
        const rd = new Date(r.date);
        const diff = Math.floor((now - rd) / 86400000);
        if (period === '7' && diff > 7) return;
        if (period === '30' && diff > 30) return;
        const key = rd.toLocaleDateString('zh-CN');
        if (!data[key]) data[key] = { date: key, questions: 0, correct: 0 };
        data[key].questions += r.totalQuestions;
        data[key].correct += r.correct;
    });
    const days = period === '7' ? 7 : (period === '30' ? 30 : Math.max(30, Object.keys(data).length));
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toLocaleDateString('zh-CN');
        result.push({ date: key, shortDate: `${d.getMonth()+1}/${d.getDate()}`, questions: data[key]?.questions||0, correct: data[key]?.correct||0 });
    }
    return result;
}

function drawPracticeChart(period) {
    const canvas = document.getElementById('practiceChart');
    const noData = document.getElementById('chartNoData');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = getPracticeData(period);
    if (!data.some(d => d.questions > 0)) {
        canvas.style.display = 'none';
        noData.style.display = 'flex';
        return;
    }
    canvas.style.display = 'block';
    noData.style.display = 'none';

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    const W = rect.width, H = rect.height;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;

    ctx.clearRect(0, 0, W, H);
    // 使用 reduce 避免大数组 spread 问题
    const maxQ = data.reduce((max, d) => Math.max(max, d.questions), 10);
    const stepX = cW / Math.max(data.length - 1, 1);

    ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const y = pad.top + cH / 5 * i;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left + cW, y); ctx.stroke();
    }

    const drawLine = (color, key, dash = false) => {
        ctx.strokeStyle = color; ctx.lineWidth = 2.5;
        if (dash) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
        ctx.beginPath();
        data.forEach((p, i) => {
            const x = pad.left + stepX * i;
            const y = pad.top + cH - (p[key] / maxQ) * cH;
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        data.forEach((p, i) => {
            const x = pad.left + stepX * i;
            const y = pad.top + cH - (p[key] / maxQ) * cH;
            ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
        });
    };
    drawLine('#6366f1', 'questions');
    drawLine('#10b981', 'correct', true);

    ctx.fillStyle = '#9ca3af'; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= 5; i++) {
        ctx.fillText(Math.round(maxQ / 5 * (5 - i)), pad.left - 8, pad.top + cH / 5 * i);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    data.forEach((p, i) => {
        if (i % Math.ceil(data.length / 8) === 0 || i === data.length - 1) {
            ctx.fillText(p.shortDate, pad.left + stepX * i, pad.top + cH + 8);
        }
    });
}

function changeChartPeriod(period) {
    currentChartPeriod = period;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`period${period}`).classList.add('active');
    drawPracticeChart(period);
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

// =============================================
// select 更新
// =============================================
function updateSubjectSelects() {
    updateExamSubjectSelect();
    updateBrowseSubjectSelect();
    updateWrongSubjectSelect();
}

function updateBrowseSubjectSelect() {
    const sel = document.getElementById('browseSubjectFilter');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="all">全部学科</option>';
    subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.name;
        sel.appendChild(opt);
    });
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
    updateMobileBrowseFilterState();
}

function updateWrongSubjectSelect() {
    const sel = document.getElementById('wrongSubjectFilter');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="all">全部学科</option>';
    subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.name;
        sel.appendChild(opt);
    });
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

// =============================================
// 弹窗 / 确认框
// =============================================
function showModal(html, large = false) {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    box.className = 'modal-box' + (large ? ' modal-large' : '');
    box.innerHTML = html;
    overlay.style.display = 'flex';
    // 聚焦到模态框以支持键盘导航
    overlay.focus();
    // 添加 ESC 键关闭支持
    overlay.addEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
}

function closeModal(e) {
    if (e && e.target !== document.getElementById('modalOverlay')) return;
    const overlay = document.getElementById('modalOverlay');
    overlay.style.display = 'none';
    overlay.removeEventListener('keydown', handleModalKeydown);
    modalCallbacks = {};
}

function executeModalCallback(id) {
    if (modalCallbacks[id]) {
        const fn = modalCallbacks[id];
        closeModal();
        fn();
    }
}

function showConfirmWithOptions(message, options) {
    const uuid = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const btns = options.map((o, i) => {
        const callbackId = `${uuid}_${i}`;
        modalCallbacks[callbackId] = o.action;
        return `
            <button class="btn ${o.danger ? 'btn-danger' : (o.ghost ? 'btn-ghost' : 'btn-primary')}" onclick="executeModalCallback('${callbackId}')">
                ${o.label}
            </button>
        `;
    }).join('');
    showModal(`
        <div class="confirm-msg">${message}</div>
        <div class="modal-actions modal-actions-col">${btns}</div>
    `);
}

// =============================================
// Toast 通知
// =============================================
function showToast(message, type = 'info') {
    let container = document.getElementById('globalToastContainer') || document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
    }
    if (container.id !== 'globalToastContainer') {
        container.id = 'globalToastContainer';
    }
    if (container.parentElement !== document.body) {
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { }, 10);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// =============================================
// 键盘快捷键
// =============================================
document.addEventListener('keydown', e => {
    if (document.getElementById('examContent')?.style.display !== 'none') {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prevQuestion(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); nextQuestion(); }
        else if (!e.ctrlKey && !e.metaKey) {
            const map = { '1': 'A', 'a': 'A', 'A': 'A', '2': 'B', 'b': 'B', 'B': 'B', '3': 'C', 'c': 'C', 'C': 'C', '4': 'D', 'd': 'D', 'D': 'D' };
            if (map[e.key]) {
                const label = document.querySelector(`.q-exam-opt input[value="${map[e.key]}"]`)?.closest('label');
                if (label) label.click();
            }
        }
    }
});

// =============================================
// 工具函数
// =============================================
function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
