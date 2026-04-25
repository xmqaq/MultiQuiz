// 统计区图表渲染

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
                    <span class="dist-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colors[i%colors.length]};margin-right:6px;flex-shrink:0;"></span>${escapeHtml(s.name)}
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
    getTrackedPracticeLogRecords().forEach(record => {
        const d = new Date(record.date).toLocaleDateString('zh-CN');
        dailyData[d] = (dailyData[d] || 0) + record.totalQuestions;
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
    const practiceBySubject = new Map();
    getTrackedPracticeLogRecords().forEach(record => {
        if (!record.subjectId) return;
        if (!practiceBySubject.has(record.subjectId)) {
            practiceBySubject.set(record.subjectId, { practiced: 0, correct: 0 });
        }
        const summary = practiceBySubject.get(record.subjectId);
        summary.practiced += record.totalQuestions;
        summary.correct += record.correct;
    });

    // 计算每个学科的正确率
    const subjectAccuracy = subjects.map(s => {
        const summary = practiceBySubject.get(s.id);
        if (!summary || summary.practiced <= 0) return null;
        return {
            name: s.name,
            accuracy: Math.round((summary.correct / summary.practiced) * 100)
        };
    }).filter(Boolean);

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
    const labelDistance = rect.width < 420 ? 22 : 25;
    const maxLabelChars = rect.width < 420 ? 4 : 6;

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
    subjectAccuracy.forEach((s, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const x = cx + Math.cos(angle) * (radius + labelDistance);
        const y = cy + Math.sin(angle) * (radius + labelDistance);

        // 轴线
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
        ctx.stroke();

        const labelLines = [];
        const rawName = String(s.name || '').trim();
        for (let idx = 0; idx < rawName.length; idx += maxLabelChars) {
            labelLines.push(rawName.slice(idx, idx + maxLabelChars));
        }
        if (labelLines.length > 2) {
            const secondLine = labelLines[1].slice(0, Math.max(1, maxLabelChars - 1));
            labelLines.splice(2);
            labelLines[1] = `${secondLine}…`;
        }

        ctx.textAlign = x < cx - 6 ? 'right' : (x > cx + 6 ? 'left' : 'center');
        ctx.textBaseline = 'middle';
        labelLines.forEach((line, lineIndex) => {
            const offsetY = (lineIndex - (labelLines.length - 1) / 2) * 14;
            ctx.fillText(line, x, y + offsetY);
        });
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
