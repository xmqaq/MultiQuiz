// 统计分析数据

function updateStats() {
    syncPracticeStatsFromPracticeLog();
    normalizePracticeStatsIfNoTrackedData();
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

function getAccuracyTrendData() {
    const sessionSummary = new Map();
    getTrackedPracticeLogRecords().forEach(record => {
        const key = record.sessionId || record.id;
        if (!sessionSummary.has(key)) {
            sessionSummary.set(key, {
                date: record.date,
                totalQuestions: 0,
                correct: 0
            });
        }
        const summary = sessionSummary.get(key);
        summary.totalQuestions += record.totalQuestions;
        summary.correct += record.correct;
        if (new Date(record.date) > new Date(summary.date)) {
            summary.date = record.date;
        }
    });

    return [...sessionSummary.values()]
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .slice(-30)
        .map(record => ({
            date: record.date,
            label: new Date(record.date).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }),
            accuracy: Math.round((record.correct / record.totalQuestions) * 100)
        }));
}

function getPracticeData(period) {
    const now = new Date();
    const data = {};
    getTrackedPracticeLogRecords().forEach(record => {
        const rd = new Date(record.date);
        const diff = Math.floor((now - rd) / 86400000);
        if (period === '7' && diff > 7) return;
        if (period === '30' && diff > 30) return;
        const key = rd.toLocaleDateString('zh-CN');
        if (!data[key]) data[key] = { date: key, questions: 0, correct: 0 };
        data[key].questions += record.totalQuestions;
        data[key].correct += record.correct;
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

function changeChartPeriod(period) {
    currentChartPeriod = period;
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`period${period}`).classList.add('active');
    drawPracticeChart(period);
}
