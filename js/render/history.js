// 历史记录渲染

function showExamHistory() {
    const container = document.getElementById('historyList');
    if (examHistory.length === 0) {
        container.innerHTML = `<div class="empty-state empty-state--minimal"><div class="empty-title">暂无考试记录</div><div class="empty-desc">完成一次模拟答题后，记录将显示在这里</div></div>`;
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
                        <span class="history-subject-tag">${escapeHtml(r.subjectName || '全部学科')}</span>
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
