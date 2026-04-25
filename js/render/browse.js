// 浏览题目列表渲染

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
    return `<div class="q-tags q-tags-inline">${tags.map(tag => {
        const safeClass = sanitizeCssToken(tag);
        const className = safeClass ? `q-tag tag-${safeClass}` : 'q-tag';
        return `<span class="${className}">${escapeHtml(tag)}</span>`;
    }).join('')}</div>`;
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
            <button class="tag-chip ${curTag === tag ? 'active' : ''}" onclick='filterByTag(${JSON.stringify(tag)}, event)'>${escapeHtml(tag)}</button>
        `).join('')}
        <button class="tag-chip" onclick="filterByTag('', event)">清除</button>
    `;
}
