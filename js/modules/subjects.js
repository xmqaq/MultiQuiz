// 题库中心业务操作

function quickExam(subjectId) {
    switchTab('exam');
    setTimeout(() => {
        const sel = document.getElementById('examSubject');
        sel.value = subjectId;
        onExamSubjectChange();
    }, 50);
}

function browseSubject(subjectId) {
    switchTab('browse');
    setTimeout(() => {
        document.getElementById('browseSubjectFilter').value = subjectId;
        displayBrowseQuestions();
    }, 50);
}

function showSubjectActions() {
    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">题库管理</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p style="margin-bottom:16px;color:var(--text-secondary)">低频管理操作集中在这里，首页保留导入题库与导入配置入口。</p>
            <div class="modal-actions modal-actions-col">
                <button class="btn btn-secondary" onclick="closeModal(); showLibraryInfo()">查看题库信息</button>
                <button class="btn btn-secondary" onclick="closeModal(); exportAllBackup()">导出配置</button>
                <button class="btn btn-secondary" onclick="closeModal(); deduplicateLibrary()">题库去重</button>
                <button class="btn btn-danger" onclick="closeModal(); clearLibrary()">清空全部题库</button>
            </div>
        </div>
    `);
}

function showSubjectCardActions(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;

    showModal(`
        <div class="modal-header">
            <h3 class="modal-title">${escapeHtml(subject.name)}</h3>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="modal-body">
            <p class="browse-actions-note">这里保留当前题库的管理操作，避免卡片顶部出现过多按钮。</p>
            <div class="modal-actions modal-actions-col">
                <button class="btn btn-secondary" onclick="closeModal(); renameSubject('${subject.id}')">编辑题库名</button>
                <button class="btn btn-secondary" onclick="closeModal(); exportSubject('${subject.id}')">导出当前题库</button>
                <button class="btn btn-danger" onclick="closeModal(); deleteSubject('${subject.id}')">删除当前题库</button>
            </div>
        </div>
    `);
}

function renameSubject(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    const newName = prompt(`重命名学科\n\n当前名称：${subject.name}`, subject.name);
    if (!newName || !newName.trim()) return;
    const trimmed = newName.trim();
    if (trimmed === subject.name) { showToast('名称未改变', 'info'); return; }
    const exists = subjects.some(s => s.id !== subjectId && s.name === trimmed);
    if (exists) { showToast('该学科名称已存在', 'error'); return; }
    subject.name = trimmed;
    wrongQuestions.forEach(q => { if (q.subjectId === subjectId) q.subjectName = trimmed; });
    examHistory.forEach(r => {
        if (r.subjectId === subjectId) r.subjectName = trimmed;
        if (Array.isArray(r.questions)) {
            r.questions.forEach(question => {
                if ((question.subjectId || r.subjectId) === subjectId) {
                    question.subjectName = trimmed;
                }
            });
        }
    });
    practiceLog.forEach(record => {
        if (record.subjectId === subjectId) {
            record.subjectName = trimmed;
        }
    });
    saveSubjects();
    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
    safeSetItem('examHistory', JSON.stringify(examHistory));
    persistPracticeTracking();
    renderAll();
    showToast(`学科已改名为「${trimmed}」`, 'success');
}

function deleteSubject(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    showConfirmWithOptions(`确定删除「${escapeHtml(subject.name)}」题库？<br>将删除 ${subject.questions.length} 道题目，此操作不可恢复。`, [
        {
            label: '确认删除',
            danger: true,
            action: () => {
                const cleanup = clearSubjectAssociatedData(subject);
                subjects = subjects.filter(s => s.id !== subjectId);
                saveSubjects();
                renderAll();
                showToast(`已删除「${subject.name}」题库${cleanup.hadExamSession ? '，并清除了未完成考试缓存' : ''}`, 'success');
            }
        },
        { label: '取消', ghost: true, action: () => {} }
    ], true);
}

function exportSubject(subjectId) {
    const subject = subjects.find(s => s.id === subjectId);
    if (!subject) return;
    const config = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        subjectName: subject.name,
        totalQuestions: subject.questions.length,
        questions: subject.questions
    };
    downloadJson(config, `${subject.name}-题库-${today()}.json`);
    showToast(`「${subject.name}」题库已导出`, 'success');
}
