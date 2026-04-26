// 静态页面事件绑定

const STATIC_CLICK_ACTIONS = {
    'toggle-sidebar': () => toggleSidebar(),
    'open-restore-file': () => openFilePicker('restoreFileInput'),
    'show-subject-actions': () => showSubjectActions(),
    'switch-tab': trigger => switchTab(trigger.dataset.tab),
    'open-import-file': () => openFilePicker('fileInput'),
    'import-subject': () => importSubject(),
    'download-excel-template': () => downloadExcelTemplate(),
    'download-json-template': () => downloadJsonTemplate(),
    'toggle-browse-answer-mode': () => toggleBrowseAnswerMode(),
    'show-browse-actions': () => showBrowseActions(),
    'toggle-mobile-browse-filters': () => toggleMobileBrowseFilters(),
    'start-exam': () => startExam(),
    'toggle-answer-card': () => toggleAnswerCard(),
    'prev-question': () => prevQuestion(),
    'next-question': () => nextQuestion(),
    'submit-exam': () => submitExam(),
    'start-wrong-practice': () => startWrongQuestionsPractice(),
    'clear-wrong-questions': () => clearWrongQuestions(),
    'export-history': () => exportHistory(),
    'clear-history': () => clearHistory(),
    'change-chart-period': trigger => changeChartPeriod(trigger.dataset.period),
    'close-sidebar-mobile': () => closeSidebarOnMobile()
};

const STATIC_CHANGE_ACTIONS = {
    'restore-backup': input => restoreFromBackup(input),
    'browse-filter': () => onBrowseFilterChange(),
    'exam-subject': () => onExamSubjectChange(),
    'wrong-subject-filter': () => filterWrongQuestions()
};

function initStaticEventBindings() {
    if (document.body.dataset.staticEventsBound === 'true') return;
    document.body.dataset.staticEventsBound = 'true';

    document.addEventListener('click', handleStaticClick);
    document.addEventListener('change', handleStaticChange);

    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) modalOverlay.addEventListener('click', closeModal);
}

function handleStaticClick(event) {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;

    const action = STATIC_CLICK_ACTIONS[trigger.dataset.action];
    if (!action) return;

    event.preventDefault();
    action(trigger, event);
}

function handleStaticChange(event) {
    const trigger = event.target.closest('[data-change-action]');
    if (!trigger) return;

    const action = STATIC_CHANGE_ACTIONS[trigger.dataset.changeAction];
    if (!action) return;

    action(trigger, event);
}

function openFilePicker(inputId) {
    const input = document.getElementById(inputId);
    if (input) input.click();
}
