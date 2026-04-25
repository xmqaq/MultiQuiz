// 考试记录

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
            <h3 class="modal-title">考试详情 — ${escapeHtml(r.subjectName || '')}</h3>
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
        _subjectId: q.subjectId || r.subjectId,
        _subjectName: q.subjectName || r.subjectName
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
    updateExamInteractionState();
    saveExamSession();
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

function normalizePracticeStatsIfNoTrackedData() {
    if (practiceLog.length > 0 || examHistory.length > 0 || wrongQuestions.length > 0) return false;

    const practiced = Number(practiceStats?.practiced) || 0;
    const correct = Number(practiceStats?.correct) || 0;
    const total = Number(practiceStats?.total) || 0;
    if (practiced === 0 && correct === 0 && total === 0) return false;

    practiceStats = { total: 0, correct: 0, practiced: 0 };
    safeSetItem('practiceStats', JSON.stringify(practiceStats));
    return true;
}

function refreshStatsViews() {
    updateStats();
    if (!document.getElementById('page-stats')?.classList.contains('active')) return;

    requestAnimationFrame(() => {
        renderSubjectDist();
        requestAnimationFrame(() => drawPracticeChart(currentChartPeriod));
    });
}

function deleteExamRecord(recordId) {
    showConfirmWithOptions('确定删除这条考试记录？', [
        {
            label: '删除记录',
            danger: true,
            action: () => {
                const hadRecord = examHistory.some(r => r.id === recordId);
                if (!hadRecord) return;
                examHistory = examHistory.filter(r => r.id !== recordId);
                practiceLog = practiceLog.filter(record => record.sourceExamRecordId !== recordId);
                normalizePracticeStatsIfNoTrackedData();
                safeSetItem('examHistory', JSON.stringify(examHistory));
                persistPracticeTracking();
                showExamHistory();
                refreshStatsViews();
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
                const removedIds = new Set(examHistory.map(record => record.id));
                examHistory = [];
                practiceLog = practiceLog.filter(record => !record.sourceExamRecordId || !removedIds.has(record.sourceExamRecordId));
                normalizePracticeStatsIfNoTrackedData();
                safeSetItem('examHistory', JSON.stringify(examHistory));
                persistPracticeTracking();
                showExamHistory();
                refreshStatsViews();
                showToast('考试记录已清空，统计已同步更新', 'success');
            }
        },
        { label: '取消', ghost: true, action: () => {} }
    ]);
}
