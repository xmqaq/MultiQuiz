// 应用启动、初始化、总装配

function initApp() {
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
