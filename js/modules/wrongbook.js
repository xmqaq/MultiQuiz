// 错题本

function displayWrongQuestions(filterSubjectId) {
    const container = document.getElementById('wrongQuestions');
    const desc = document.getElementById('wrongCountDesc');
    const filterSel = document.getElementById('wrongSubjectFilter');

    const fid = filterSubjectId || (filterSel ? filterSel.value : 'all');
    let pool = fid === 'all' ? wrongQuestions : wrongQuestions.filter(q => q.subjectId === fid);

    desc.textContent = `共 ${wrongQuestions.length} 道错题`;
    if (wrongQuestions.length === 0) {
        container.innerHTML = `<div class="empty-state empty-state--minimal"><div class="empty-title">暂无错题</div><div class="empty-desc">完成模拟答题后，错题会自动记录在这里</div></div>`;
        return;
    }
    if (pool.length === 0) {
        container.innerHTML = `<div class="empty-state empty-state--minimal"><div class="empty-title">该学科暂无错题</div></div>`;
        return;
    }

    container.innerHTML = pool.map((q, i) => `
        <div class="wrong-item">
            <div class="wrong-item-header">
                <span class="wrong-num">${i + 1}</span>
                <span class="subject-tag">${escapeHtml(q.subjectName || '')}</span>
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
                normalizePracticeStatsIfNoTrackedData();
                safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
                displayWrongQuestions();
                refreshStatsViews();
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

    updateExamInteractionState();
    saveExamSession();
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
