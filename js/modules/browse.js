// 题目浏览、搜索、标签、收藏与导出

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
                        ${currentTags.includes(tag) ? '✓ ' : ''}${escapeHtml(tag)}
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
                ${subject ? `当前学科：${escapeHtml(subject.name)}` : '全部学科'}，共 ${questionCount} 道题目
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
                    <div class="q-title">${i + 1}. ${escapeHtml(q.question)}<span class="subject-tag">[${escapeHtml(q._subjectName || '')}]</span></div>
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
                    practiceLog = [];
                    questionTags = {};
                    favoriteSet = new Set();
                    practiceStats = { total: 0, correct: 0, practiced: 0 };
                    saveSubjects();
                    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
                    safeSetItem('examHistory', JSON.stringify(examHistory));
                    safeSetItem('questionTags', JSON.stringify(questionTags));
                    persistPracticeTracking();
                    saveFavorites();
                    const hadExamSession = resetExamStateAfterLibraryChange();
                    renderAll();
                    showToast(`全部题库及相关练习数据已清空${hadExamSession ? '，并清除了未完成考试缓存' : ''}`, 'success');
                }
            },
            { label: '取消', ghost: true, action: () => {} }
        ], true);
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
        ],
        true
    );
}
