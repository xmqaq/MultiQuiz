// Excel / JSON 导入

function initFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const fileInputDisplay = document.getElementById('fileInputDisplay');

    fileInput.addEventListener('change', e => {
        if (e.target.files[0]) {
            fileInputDisplay.value = e.target.files[0].name;
        }
    });
}

function importSubject() {
    const subjectName = document.getElementById('subjectName').value.trim();
    const fileInput = document.getElementById('fileInput');

    if (!subjectName) {
        showToast('请填写学科名称', 'error');
        document.getElementById('subjectName').focus();
        return;
    }

    if (!fileInput.files[0]) {
        showToast('请选择题库文件', 'error');
        return;
    }

    const file = fileInput.files[0];
    const name = file.name.toLowerCase();

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        parseExcel(file, subjectName);
    } else if (name.endsWith('.json')) {
        parseJson(file, subjectName);
    } else {
        showToast('不支持的文件格式', 'error');
    }
}

function handleFile(file) {
    const subjectNameInput = document.getElementById('subjectName');
    const subjectName = subjectNameInput.value.trim();
    if (!subjectName) {
        showToast('请先填写学科名称', 'error');
        subjectNameInput.focus();
        return;
    }

    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) {
        parseJson(file, subjectName);
    } else if (name.match(/\.(xlsx|xls)$/)) {
        parseExcel(file, subjectName);
    } else {
        showToast('请选择 Excel (.xlsx/.xls) 或 JSON 文件', 'error');
    }
}

function downloadStaticFile(filePath, downloadName, successMessage) {
    const link = document.createElement('a');
    link.href = filePath;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(successMessage, 'success');
}

function downloadExcelTemplate() {
    downloadStaticFile('./templates/multiquiz-template.xlsx', 'MultiQuiz-Excel题库模板.xlsx', 'Excel 模板已下载');
}

function downloadJsonTemplate() {
    downloadStaticFile('./templates/multiquiz-template.json', 'MultiQuiz-JSON题库模板.json', 'JSON 模板已下载');
}

function parseExcel(file, subjectName) {
    showToast('正在读取文件...', 'info');
    const reader = new FileReader();
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.onload = e => {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
            const parsed = parseExcelRows(rows);
            if (parsed.length === 0) { showToast('未找到有效题目，请检查 Excel 格式', 'error'); return; }
            importQuestions(parsed, subjectName);
        } catch (err) {
            showToast('文件解析失败：' + err.message, 'error');
        }
    };
    if (typeof reader.readAsArrayBuffer === 'function') {
        reader.readAsArrayBuffer(file);
    } else {
        reader.onload = e => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
                const parsed = parseExcelRows(rows);
                if (parsed.length === 0) { showToast('未找到有效题目，请检查 Excel 格式', 'error'); return; }
                importQuestions(parsed, subjectName);
            } catch (err) { showToast('文件解析失败', 'error'); }
        };
        reader.readAsBinaryString(file);
    }
}

function parseExcelRows(rows) {
    const result = [];
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length >= 6 && row[0]) {
            const normalized = normalizeImportedQuestion({
                question: row[0],
                optionA: row[1],
                optionB: row[2],
                optionC: row[3],
                optionD: row[4],
                answer: row[5]
            });
            if (normalized) {
                result.push(normalized);
            }
        }
    }
    return result;
}

function parseJson(file, subjectName) {
    showToast('正在读取配置文件...', 'info');
    const reader = new FileReader();
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.onload = e => {
        try {
            const config = JSON.parse(e.target.result);
            let rawQuestions = Array.isArray(config) ? config : (config.questions || []);
            const valid = rawQuestions
                .map(q => normalizeImportedQuestion(q))
                .filter(Boolean);
            if (valid.length === 0) { showToast('未找到格式正确的题目', 'error'); return; }
            importQuestions(valid, subjectName);
        } catch (err) {
            showToast('JSON 解析失败：' + err.message, 'error');
        }
    };
    reader.readAsText(file, 'utf-8');
}

function importQuestions(newQuestions, subjectName) {
    const existing = subjects.find(s => s.name === subjectName);
    if (existing) {
        showConfirmWithOptions(
            `学科「${subjectName}」已有 ${existing.questions.length} 道题目，新文件包含 ${newQuestions.length} 道题。`,
            [
                { label: `追加题目（共 ${existing.questions.length + newQuestions.length} 题）`, action: () => {
                    existing.questions = [...existing.questions, ...newQuestions];
                    saveSubjects();
                    afterImport(subjectName, newQuestions.length, existing.questions.length);
                }},
                { label: `覆盖题库（替换为 ${newQuestions.length} 题）`, action: () => {
                    const cleanup = clearSubjectAssociatedData(existing);
                    existing.questions = newQuestions;
                    saveSubjects();
                    afterImport(
                        subjectName,
                        newQuestions.length,
                        newQuestions.length,
                        cleanup.hadExamSession
                            ? '已覆盖旧题库，并清除了旧题关联数据及未完成考试缓存'
                            : '已覆盖旧题库，并清除了旧题关联数据'
                    );
                }},
                { label: '取消', danger: false, ghost: true, action: () => {} }
            ]
        );
    } else {
        subjects.push({ id: genId(), name: subjectName, questions: newQuestions });
        saveSubjects();
        afterImport(subjectName, newQuestions.length, newQuestions.length);
    }
}

function afterImport(subjectName, added, total, successMessage) {
    renderAll();
    document.getElementById('subjectName').value = '';
    document.getElementById('fileInput').value = '';
    document.getElementById('fileInputDisplay').value = '未选择文件';
    showToast(successMessage || `成功导入 ${added} 道题目到「${subjectName}」，共 ${total} 题`, 'success');
    switchTab('subjects');
}
