// 题库卡片和选择器渲染

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
        card.className = `subject-card${wrongCount > 0 ? ' subject-card--attention' : ''}`;
        card.innerHTML = `
            <div class="subject-card-top">
                <div class="subject-card-name">${escapeHtml(subject.name)}</div>
                <div class="subject-card-actions">
                    <button class="icon-btn subject-action-btn" title="管理题库" onclick="showSubjectCardActions('${subject.id}')">管理</button>
                </div>
            </div>
            <div class="subject-card-stats">
                <div class="sc-stat sc-stat--total">
                    <div class="sc-stat-num">${total}</div>
                    <div class="sc-stat-label">题目</div>
                </div>
                <div class="sc-stat sc-stat--wrong${wrongCount > 0 ? ' sc-stat--active' : ''}">
                    <div class="sc-stat-num${wrongCount > 0 ? ' sc-stat-num--wrong' : ''}">${wrongCount}</div>
                    <div class="sc-stat-label">错题</div>
                </div>
                <div class="sc-stat sc-stat--favorite${favoriteCount > 0 ? ' sc-stat--active' : ''}">
                    <div class="sc-stat-num${favoriteCount > 0 ? ' sc-stat-num--favorite' : ''}">${favoriteCount}</div>
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
