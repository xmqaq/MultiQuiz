// 全局变量
let questions = [];
let currentExam = {
    questions: [],
    currentIndex: 0,
    answers: {},
    startTime: null,
    timeLimit: 60,
    timer: null
};
let wrongQuestions = JSON.parse(localStorage.getItem('wrongQuestions') || '[]');
let practiceStats = JSON.parse(localStorage.getItem('practiceStats') || '{ "total": 0, "correct": 0, "practiced": 0 }');
let examHistory = JSON.parse(localStorage.getItem('examHistory') || '[]');

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    checkMobileCompatibility();
});

// 检测移动设备兼容性
function checkMobileCompatibility() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
        // 检查FileReader API支持
        const reader = new FileReader();
        const hasArrayBuffer = typeof reader.readAsArrayBuffer === 'function';
        const hasBinaryString = typeof reader.readAsBinaryString === 'function';
        
        if (!hasArrayBuffer && !hasBinaryString) {
            showMessage('检测到移动设备，文件导入功能可能受限，建议使用电脑浏览器', 'warning');
        } else if (!hasArrayBuffer) {
            showMessage('移动端检测：将使用兼容模式导入文件', 'info');
        }
        
        // 在移动端显示额外提示
        const mobileNotice = document.querySelector('.mobile-notice');
        if (mobileNotice) {
            mobileNotice.style.display = 'block';
            mobileNotice.style.background = '#f8d7da';
            mobileNotice.style.borderColor = '#f5c6cb';
        }
    }
}

function initializeApp() {
    // 初始化标签页切换
    initTabSwitching();
    
    // 初始化文件上传
    initFileUpload();
    
    // 更新统计信息
    updateStats();
    
    // 显示错题本
    displayWrongQuestions();
    
    // 从本地存储加载题库
    const savedQuestions = localStorage.getItem('questions');
    if (savedQuestions) {
        questions = JSON.parse(savedQuestions);
        displayQuestions();
        updateStats();
    } else {
        // 如果本地存储中没有题库，尝试自动加载同目录下的JSON文件
        autoLoadLocalJsonFiles();
    }
}

// 标签页切换功能
function initTabSwitching() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            // 移除所有活动状态
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // 添加活动状态
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // 特定页面的初始化逻辑
            if (targetTab === 'history') {
                showExamHistory();
            }
        });
    });
}

// 文件上传功能
function initFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const uploadArea = document.getElementById('uploadArea');
    
    // 点击上传区域触发文件选择
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // 文件选择处理
    fileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

// 处理文件选择
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

// 处理文件（支持Excel和JSON配置文件）
function handleFile(file) {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.json')) {
        handleJsonConfigFile(file);
        return;
    }
    
    if (!fileName.match(/\.(xlsx|xls)$/)) {
        showMessage('请选择Excel文件（.xlsx或.xls格式）或JSON配置文件', 'error');
        return;
    }
    
    showMessage('正在读取文件...', 'info');
    
    const reader = new FileReader();
    
    // 添加错误处理
    reader.onerror = function() {
        showMessage('文件读取失败，请尝试使用电脑浏览器', 'error');
        console.error('FileReader错误');
    };
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            parseQuestions(jsonData);
        } catch (error) {
            showMessage('文件读取失败，请检查文件格式', 'error');
            console.error('文件读取错误:', error);
        }
    };
    
    // 检查移动端兼容性并提供备用方案
    if (typeof reader.readAsArrayBuffer === 'function') {
        try {
            reader.readAsArrayBuffer(file);
        } catch (error) {
            console.error('readAsArrayBuffer失败，尝试备用方案:', error);
            handleFileWithBinaryString(file);
        }
    } else {
        // 移动端备用方案
        handleFileWithBinaryString(file);
    }
}

// 移动端备用文件处理方案
function handleFileWithBinaryString(file) {
    const reader = new FileReader();
    
    reader.onerror = function() {
        showMessage('文件读取失败，建议使用电脑浏览器或尝试较小的文件', 'error');
    };
    
    reader.onload = function(e) {
        try {
            // 使用二进制字符串方式读取
            const binaryString = e.target.result;
            const workbook = XLSX.read(binaryString, { type: 'binary' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            parseQuestions(jsonData);
        } catch (error) {
            showMessage('文件处理失败，请确保文件格式正确或尝试使用电脑浏览器', 'error');
            console.error('二进制读取错误:', error);
        }
    };
    
    // 使用readAsBinaryString作为备用方案
    if (typeof reader.readAsBinaryString === 'function') {
        reader.readAsBinaryString(file);
    } else {
        // 最后的备用方案：使用readAsDataURL
        reader.onload = function(e) {
            try {
                // 从data URL中提取base64数据
                const dataUrl = e.target.result;
                const base64 = dataUrl.split(',')[1];
                const workbook = XLSX.read(base64, { type: 'base64' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                parseQuestions(jsonData);
            } catch (error) {
                showMessage('移动端文件处理失败，请使用电脑浏览器', 'error');
                console.error('DataURL读取错误:', error);
            }
        };
        reader.readAsDataURL(file);
    }
}

// 解析题目数据
function parseQuestions(data) {
    const parsedQuestions = [];
    
    // 跳过表头，从第二行开始
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row.length >= 6 && row[0]) { // 确保有足够的列和题目内容
            const question = {
                id: i,
                question: row[0] || '',
                optionA: row[1] || '',
                optionB: row[2] || '',
                optionC: row[3] || '',
                optionD: row[4] || '',
                answer: (row[5] || '').toString().toUpperCase().trim()
            };
            
            // 验证答案格式
            if (['A', 'B', 'C', 'D'].includes(question.answer)) {
                parsedQuestions.push(question);
            }
        }
    }
    
    if (parsedQuestions.length === 0) {
        showMessage('未找到有效题目，请检查Excel格式', 'error');
        return;
    }
    
    // 如果已有题库，询问用户是否要追加或覆盖
    if (questions.length > 0) {
        showImportOptions(parsedQuestions);
    } else {
        // 首次导入，直接保存
        saveQuestions(parsedQuestions, 'replace');
    }
}

// 临时存储待导入的题目
let pendingQuestions = [];

// 显示导入选项对话框
function showImportOptions(newQuestions) {
    pendingQuestions = newQuestions;
    const existingCount = questions.length;
    const newCount = newQuestions.length;
    
    const optionsHtml = `
        <div class="import-options-dialog">
            <div class="dialog-content">
                <h3>📚 题库导入选项</h3>
                <p>检测到已有 <strong>${existingCount}</strong> 道题目，新文件包含 <strong>${newCount}</strong> 道题目。</p>
                <div class="import-choices">
                    <button class="btn btn-primary" onclick="saveQuestions(pendingQuestions, 'append')">
                        ➕ 追加题目 (总计: ${existingCount + newCount}题)
                    </button>
                    <button class="btn btn-secondary" onclick="saveQuestions(pendingQuestions, 'replace')">
                        🔄 覆盖题库 (替换为: ${newCount}题)
                    </button>
                    <button class="btn btn-danger" onclick="closeImportDialog()">
                        ❌ 取消导入
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 显示对话框
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'dialog-overlay';
    dialogContainer.innerHTML = optionsHtml;
    document.body.appendChild(dialogContainer);
}

// 保存题目数据
function saveQuestions(newQuestions, mode) {
    // 重新分配ID以避免冲突
    if (mode === 'append') {
        const maxId = questions.length > 0 ? Math.max(...questions.map(q => q.id)) : 0;
        newQuestions = newQuestions.map((q, index) => ({
            ...q,
            id: maxId + index + 1
        }));
        questions = [...questions, ...newQuestions];
        showMessage(`成功追加 ${newQuestions.length} 道题目！当前总计 ${questions.length} 题`, 'success');
    } else {
        questions = newQuestions;
        showMessage(`成功导入 ${questions.length} 道题目！`, 'success');
    }
    
    // 保存到localStorage
    localStorage.setItem('questions', JSON.stringify(questions));
    
    // 自动保存为本地配置文件
    autoSaveQuestionsConfig();
    
    displayQuestions();
    updateStats();
    closeImportDialog();
    
    // 自动切换到题库页面
    document.querySelector('[data-tab="practice"]').click();
}

// 自动保存题库配置文件
function autoSaveQuestionsConfig() {
    if (questions.length === 0) return;
    
    const config = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        totalQuestions: questions.length,
        questions: questions,
        metadata: {
            exportedBy: 'CISP-PTE练习题库',
            description: '题库配置文件 - 可直接导入使用'
        }
    };
    
    const configJson = JSON.stringify(config, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // 创建隐藏的下载链接
    const link = document.createElement('a');
    link.href = url;
    link.download = `cisp-pte-questions-${new Date().toISOString().split('T')[0]}.json`;
    link.style.display = 'none';
    
    // 询问用户是否要保存配置文件
    if (confirm('是否同时保存题库配置文件到本地？\n(推荐保存，便于备份和分享)')) {
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showMessage('题库配置文件已保存到下载文件夹', 'success');
    }
    
    URL.revokeObjectURL(url);
}

// 处理JSON配置文件
function handleJsonConfigFile(file) {
    showMessage('正在读取配置文件...', 'info');
    
    const reader = new FileReader();
    
    reader.onerror = function() {
        showMessage('配置文件读取失败', 'error');
    };
    
    reader.onload = function(e) {
        try {
            const configData = JSON.parse(e.target.result);
            
            // 验证配置文件格式
            if (!validateConfigFile(configData)) {
                showMessage('配置文件格式不正确，请检查文件内容', 'error');
                return;
            }
            
            const questionsData = configData.questions || configData;
            
            // 验证题目数据
            if (!Array.isArray(questionsData) || questionsData.length === 0) {
                showMessage('配置文件中未找到有效题目数据', 'error');
                return;
            }
            
            // 验证题目格式
            const validQuestions = questionsData.filter(q => 
                q.question && q.optionA && q.optionB && q.optionC && q.optionD && 
                ['A', 'B', 'C', 'D'].includes((q.answer || '').toString().toUpperCase())
            );
            
            if (validQuestions.length === 0) {
                showMessage('配置文件中未找到格式正确的题目', 'error');
                return;
            }
            
            // 标准化题目数据
            const normalizedQuestions = validQuestions.map((q, index) => ({
                id: index + 1,
                question: q.question.toString(),
                optionA: q.optionA.toString(),
                optionB: q.optionB.toString(),
                optionC: q.optionC.toString(),
                optionD: q.optionD.toString(),
                answer: q.answer.toString().toUpperCase().trim()
            }));
            
            showMessage(`从配置文件中解析到 ${normalizedQuestions.length} 道有效题目`, 'success');
            
            // 如果已有题库，显示导入选项
            if (questions.length > 0) {
                showImportOptions(normalizedQuestions);
            } else {
                saveQuestions(normalizedQuestions, 'replace');
            }
            
        } catch (error) {
            showMessage('配置文件解析失败，请检查JSON格式', 'error');
            console.error('JSON解析错误:', error);
        }
    };
    
    reader.readAsText(file, 'utf-8');
}

// 验证配置文件格式
function validateConfigFile(config) {
    // 支持直接的题目数组格式
    if (Array.isArray(config)) {
        return true;
    }
    
    // 支持包含questions字段的配置对象
    if (config && typeof config === 'object' && Array.isArray(config.questions)) {
        return true;
    }
    
    return false;
}

// 关闭导入对话框
function closeImportDialog() {
    const dialog = document.querySelector('.dialog-overlay');
    if (dialog) {
        dialog.remove();
    }
}

// 显示题库信息
function showLibraryInfo() {
    if (questions.length === 0) {
        showMessage('题库为空，请先导入题目', 'error');
        return;
    }
    
    const totalQuestions = questions.length;
    const answerDistribution = {
        A: questions.filter(q => q.answer === 'A').length,
        B: questions.filter(q => q.answer === 'B').length,
        C: questions.filter(q => q.answer === 'C').length,
        D: questions.filter(q => q.answer === 'D').length
    };
    
    const infoHtml = `
        <div class="import-options-dialog">
            <div class="dialog-content">
                <h3>📊 题库详细信息</h3>
                <div class="library-stats">
                    <div class="stat-item">
                        <span class="stat-label">总题数：</span>
                        <span class="stat-value">${totalQuestions} 题</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">答案分布：</span>
                        <div class="answer-distribution">
                            <div class="answer-item">A: ${answerDistribution.A} 题 (${Math.round(answerDistribution.A/totalQuestions*100)}%)</div>
                            <div class="answer-item">B: ${answerDistribution.B} 题 (${Math.round(answerDistribution.B/totalQuestions*100)}%)</div>
                            <div class="answer-item">C: ${answerDistribution.C} 题 (${Math.round(answerDistribution.C/totalQuestions*100)}%)</div>
                            <div class="answer-item">D: ${answerDistribution.D} 题 (${Math.round(answerDistribution.D/totalQuestions*100)}%)</div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">存储大小：</span>
                        <span class="stat-value">${Math.round(JSON.stringify(questions).length / 1024)} KB</span>
                    </div>
                </div>
                <button class="btn btn-primary" onclick="closeImportDialog()">确定</button>
            </div>
        </div>
    `;
    
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'dialog-overlay';
    dialogContainer.innerHTML = infoHtml;
    document.body.appendChild(dialogContainer);
}

// 导出题库
function exportQuestions() {
    if (questions.length === 0) {
        showMessage('题库为空，无法导出', 'error');
        return;
    }
    
    // 显示导出格式选择对话框
    showExportDialog();
}

// 显示导出格式选择对话框
function showExportDialog() {
    const dialogHtml = `
        <div class="export-dialog">
            <div class="dialog-content">
                <h3>📤 选择导出格式</h3>
                <p>当前题库包含 <strong>${questions.length}</strong> 道题目</p>
                <div class="export-options">
                    <button class="btn btn-primary" onclick="exportAsJson()">
                        ⚙️ JSON配置文件 (推荐)
                        <small>包含完整数据，支持直接导入</small>
                    </button>
                    <button class="btn btn-secondary" onclick="exportAsCsv()">
                        📊 CSV表格文件
                        <small>可用Excel打开编辑</small>
                    </button>
                    <button class="btn btn-info" onclick="exportBoth()">
                        📦 同时导出两种格式
                        <small>获得最大兼容性</small>
                    </button>
                    <button class="btn btn-danger" onclick="closeExportDialog()">
                        ❌ 取消
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const dialogContainer = document.createElement('div');
    dialogContainer.className = 'dialog-overlay';
    dialogContainer.innerHTML = dialogHtml;
    document.body.appendChild(dialogContainer);
}

// 导出为JSON配置文件
function exportAsJson() {
    const config = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        totalQuestions: questions.length,
        questions: questions,
        metadata: {
            exportedBy: 'CISP-PTE练习题库',
            description: '题库配置文件 - 可直接导入使用',
            exportType: 'manual'
        }
    };
    
    const configJson = JSON.stringify(config, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `cisp-pte-questions-${new Date().toISOString().split('T')[0]}.json`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    closeExportDialog();
    showMessage(`成功导出JSON配置文件 (${questions.length}题)`, 'success');
}

// 导出为CSV文件
function exportAsCsv() {
    const csvContent = [
        ['题目', '选项A', '选项B', '选项C', '选项D', '正确答案'],
        ...questions.map(q => [
            q.question,
            q.optionA,
            q.optionB,
            q.optionC,
            q.optionD,
            q.answer
        ])
    ].map(row => row.map(cell => `"${cell.toString().replace(/"/g, '""')}"`).join(',')).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `CISP-PTE题库_${new Date().toISOString().split('T')[0]}.csv`;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    closeExportDialog();
    showMessage(`成功导出CSV文件 (${questions.length}题)`, 'success');
}

// 同时导出两种格式
function exportBoth() {
    exportAsJson();
    setTimeout(() => {
        exportAsCsv();
        showMessage('已同时导出JSON和CSV两种格式', 'success');
    }, 500);
}

// 关闭导出对话框
function closeExportDialog() {
    const dialog = document.querySelector('.dialog-overlay');
    if (dialog) {
        dialog.remove();
    }
}

// 清空题库
function clearLibrary() {
    if (questions.length === 0) {
        showMessage('题库已经为空', 'error');
        return;
    }
    
    if (confirm(`确定要清空题库吗？这将删除所有 ${questions.length} 道题目，此操作不可恢复！`)) {
        questions = [];
        localStorage.setItem('questions', JSON.stringify(questions));
        displayQuestions();
        updateStats();
        showMessage('题库已清空', 'success');
    }
}

// 显示题目列表
function displayQuestions(questionsToShow = questions) {
    const questionsList = document.getElementById('questionsList');
    
    if (questionsToShow.length === 0) {
        questionsList.innerHTML = '<div class="no-data">没有找到匹配的题目</div>';
        return;
    }
    
    const html = questionsToShow.map(q => `
        <div class="question-item">
            <div class="question-title">${q.id}. ${q.question}</div>
            <div class="question-options">
                <div class="option">A. ${q.optionA}</div>
                <div class="option">B. ${q.optionB}</div>
                <div class="option">C. ${q.optionC}</div>
                <div class="option">D. ${q.optionD}</div>
            </div>
            <div class="question-answer">正确答案: ${q.answer}</div>
        </div>
    `).join('');
    
    questionsList.innerHTML = html;
}

// 搜索题目
function searchQuestions() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    // 检查题库是否为空
    if (questions.length === 0) {
        showMessage('请先导入题库', 'error');
        return;
    }
    
    if (!searchTerm) {
        displayQuestions();
        showMessage('请输入搜索关键词', 'warning');
        return;
    }
    
    const filteredQuestions = questions.filter(q => 
        (q.question && q.question.toString().toLowerCase().includes(searchTerm)) ||
        (q.optionA && q.optionA.toString().toLowerCase().includes(searchTerm)) ||
        (q.optionB && q.optionB.toString().toLowerCase().includes(searchTerm)) ||
        (q.optionC && q.optionC.toString().toLowerCase().includes(searchTerm)) ||
        (q.optionD && q.optionD.toString().toLowerCase().includes(searchTerm))
    );
    
    if (filteredQuestions.length === 0) {
        showMessage(`未找到包含"${searchTerm}"的题目`, 'warning');
    } else {
        showMessage(`找到 ${filteredQuestions.length} 道相关题目`, 'success');
    }
    
    displayQuestions(filteredQuestions);
}

// 清空搜索
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    searchInput.value = '';
    displayQuestions();
    showMessage('已清空搜索条件', 'success');
}

// 开始考试
function startExam() {
    if (questions.length === 0) {
        showMessage('请先导入题库', 'error');
        return;
    }
    
    const examCount = document.getElementById('examCount').value;
    const examTime = parseInt(document.getElementById('examTime').value);
    
    // 准备考试题目
    let examQuestions = [...questions];
    if (examCount !== 'all') {
        examQuestions = shuffleArray(examQuestions).slice(0, parseInt(examCount));
    }
    
    currentExam = {
        questions: examQuestions,
        currentIndex: 0,
        answers: {},
        startTime: new Date(),
        timeLimit: examTime,
        timer: null
    };
    
    // 显示考试界面
    document.getElementById('examSetup').style.display = 'none';
    document.getElementById('examContent').style.display = 'block';
    
    // 更新题目信息
    document.getElementById('totalQuestions').textContent = examQuestions.length;
    
    // 开始计时
    startTimer();
    
    // 显示第一题
    showQuestion();
}

// 开始计时器
function startTimer() {
    let timeLeft = currentExam.timeLimit * 60; // 转换为秒
    
    currentExam.timer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(currentExam.timer);
            submitExam();
            return;
        }
        
        // 最后5分钟变红色警告
        if (timeLeft <= 300) {
            document.getElementById('timer').style.color = '#dc3545';
        }
        
        timeLeft--;
    }, 1000);
}

// 显示当前题目
function showQuestion() {
    const question = currentExam.questions[currentExam.currentIndex];
    const questionContent = document.getElementById('questionContent');
    
    document.getElementById('currentQuestion').textContent = currentExam.currentIndex + 1;
    
    const html = `
        <div class="exam-question">
            ${currentExam.currentIndex + 1}. ${question.question}
        </div>
        <div class="exam-options">
            <label class="exam-option ${currentExam.answers[question.id] === 'A' ? 'selected' : ''}">
                <input type="radio" name="answer" value="A" ${currentExam.answers[question.id] === 'A' ? 'checked' : ''}>
                A. ${question.optionA}
            </label>
            <label class="exam-option ${currentExam.answers[question.id] === 'B' ? 'selected' : ''}">
                <input type="radio" name="answer" value="B" ${currentExam.answers[question.id] === 'B' ? 'checked' : ''}>
                B. ${question.optionB}
            </label>
            <label class="exam-option ${currentExam.answers[question.id] === 'C' ? 'selected' : ''}">
                <input type="radio" name="answer" value="C" ${currentExam.answers[question.id] === 'C' ? 'checked' : ''}>
                C. ${question.optionC}
            </label>
            <label class="exam-option ${currentExam.answers[question.id] === 'D' ? 'selected' : ''}">
                <input type="radio" name="answer" value="D" ${currentExam.answers[question.id] === 'D' ? 'checked' : ''}>
                D. ${question.optionD}
            </label>
        </div>
    `;
    
    questionContent.innerHTML = html;
    
    // 添加选项点击事件
    const options = questionContent.querySelectorAll('.exam-option');
    options.forEach(option => {
        option.addEventListener('click', () => {
            const radio = option.querySelector('input[type="radio"]');
            radio.checked = true;
            
            // 更新选中状态
            options.forEach(opt => opt.classList.remove('selected'));
            option.classList.add('selected');
            
            // 保存答案
            currentExam.answers[question.id] = radio.value;
        });
    });
}

// 上一题
function prevQuestion() {
    if (currentExam.currentIndex > 0) {
        currentExam.currentIndex--;
        showQuestion();
    }
}

// 下一题
function nextQuestion() {
    if (currentExam.currentIndex < currentExam.questions.length - 1) {
        currentExam.currentIndex++;
        showQuestion();
    }
}

// 提交考试
function submitExam() {
    if (currentExam.timer) {
        clearInterval(currentExam.timer);
    }
    
    // 计算成绩
    let correctCount = 0;
    const newWrongQuestions = [];
    const correctedQuestions = []; // 错题练习中答对的题目
    
    currentExam.questions.forEach(question => {
        const userAnswer = currentExam.answers[question.id];
        if (userAnswer === question.answer) {
            correctCount++;
            // 如果是错题练习模式且答对了，记录为已纠正的错题
            if (currentExam.isWrongQuestionsPractice) {
                correctedQuestions.push(question.id);
            }
        } else {
            // 只有在非错题练习模式下才添加到错题本
            if (!currentExam.isWrongQuestionsPractice) {
                const wrongQuestion = {
                    ...question,
                    userAnswer: userAnswer || '未作答',
                    timestamp: new Date().toISOString()
                };
                newWrongQuestions.push(wrongQuestion);
            }
        }
    });
    
    // 更新错题本
    if (currentExam.isWrongQuestionsPractice) {
        // 错题练习模式：移除已纠正的错题
        wrongQuestions = wrongQuestions.filter(q => !correctedQuestions.includes(q.id));
    } else {
        // 普通考试模式：添加新错题
        wrongQuestions = [...wrongQuestions, ...newWrongQuestions];
    }
    localStorage.setItem('wrongQuestions', JSON.stringify(wrongQuestions));
    
    // 更新统计信息
    practiceStats.practiced += currentExam.questions.length;
    practiceStats.correct += correctCount;
    localStorage.setItem('practiceStats', JSON.stringify(practiceStats));
    
    const score = Math.round((correctCount / currentExam.questions.length) * 100);
    const endTime = new Date();
    const duration = Math.round((endTime - currentExam.startTime) / 1000 / 60);
    
    // 保存考试历史记录（只保存正式考试，不保存错题练习）
    if (!currentExam.isWrongQuestionsPractice) {
        const examRecord = {
            id: Date.now().toString(),
            date: new Date().toISOString(),
            score: score,
            correctCount: correctCount,
            totalQuestions: currentExam.questions.length,
            duration: duration,
            questions: currentExam.questions.map(q => ({
                id: q.id,
                question: q.question,
                optionA: q.optionA,
                optionB: q.optionB,
                optionC: q.optionC,
                optionD: q.optionD,
                correctAnswer: q.answer,
                userAnswer: currentExam.answers[q.id] || '未作答'
            })),
            wrongCount: newWrongQuestions.length
        };
        
        examHistory.unshift(examRecord); // 添加到数组开头，最新的在前面
        
        // 限制历史记录数量，最多保存50条
        if (examHistory.length > 50) {
            examHistory = examHistory.slice(0, 50);
        }
        
        localStorage.setItem('examHistory', JSON.stringify(examHistory));
    }
    
    // 显示结果
    let resultHtml;
    if (currentExam.isWrongQuestionsPractice) {
        // 错题练习模式的结果显示
        const remainingWrongCount = currentExam.questions.length - correctCount;
        resultHtml = `
            <div style="text-align: center; padding: 40px;">
                <h2>📚 错题练习完成！</h2>
                <div style="margin: 30px 0;">
                    <div style="font-size: 2.5rem; color: ${score >= 80 ? '#28a745' : '#f39c12'}; font-weight: bold;">
                        ${score}分
                    </div>
                    <div style="margin: 20px 0; font-size: 1.2rem;">
                        练习题目：${currentExam.questions.length} 题<br>
                        答对：${correctCount} 题<br>
                        ${correctedQuestions.length > 0 ? `已掌握：${correctedQuestions.length} 题` : ''}<br>
                        ${remainingWrongCount > 0 ? `仍需练习：${remainingWrongCount} 题` : '全部掌握！'}<br>
                        用时：${duration} 分钟
                    </div>
                </div>
                <button class="btn btn-primary" onclick="startWrongQuestionsPractice()">继续练习错题</button>
                <button class="btn btn-secondary" onclick="viewWrongQuestions()">查看错题本</button>
                <button class="btn btn-info" onclick="restartExam()">返回考试设置</button>
            </div>
        `;
    } else {
        // 普通考试模式的结果显示
        resultHtml = `
            <div style="text-align: center; padding: 40px;">
                <h2>🎉 考试完成！</h2>
                <div style="margin: 30px 0;">
                    <div style="font-size: 3rem; color: ${score >= 60 ? '#28a745' : '#dc3545'}; font-weight: bold;">
                        ${score}分
                    </div>
                    <div style="margin: 20px 0; font-size: 1.2rem;">
                        正确：${correctCount} / ${currentExam.questions.length} 题<br>
                        用时：${duration} 分钟<br>
                        ${newWrongQuestions.length > 0 ? `错题：${newWrongQuestions.length} 题` : '全部正确！'}
                    </div>
                </div>
                <button class="btn btn-primary" onclick="restartExam()">重新考试</button>
                <button class="btn btn-secondary" onclick="viewWrongQuestions()">查看错题</button>
                <button class="btn btn-info" onclick="switchToHistoryTab()">查看考试记录</button>
                ${newWrongQuestions.length > 0 ? '<button class="btn btn-warning" onclick="startWrongQuestionsPractice()">练习错题</button>' : ''}
            </div>
        `;
    }
    
    document.getElementById('questionContent').innerHTML = resultHtml;
    document.querySelector('.exam-controls').style.display = 'none';
    
    updateStats();
    displayWrongQuestions();
}

// 重新开始考试
function restartExam() {
    document.getElementById('examSetup').style.display = 'block';
    document.getElementById('examContent').style.display = 'none';
    document.querySelector('.exam-controls').style.display = 'flex';
    document.getElementById('timer').style.color = '#dc3545';
}

// 查看错题本
function viewWrongQuestions() {
    document.querySelector('[data-tab="wrong"]').click();
}

// 显示错题本
function displayWrongQuestions() {
    const wrongQuestionsContainer = document.getElementById('wrongQuestions');
    
    if (wrongQuestions.length === 0) {
        wrongQuestionsContainer.innerHTML = '<div class="no-data">暂无错题记录</div>';
        return;
    }
    
    const html = wrongQuestions.map((q, index) => `
        <div class="wrong-question">
            <div class="question-title">${q.question}</div>
            <div class="question-options">
                <div class="option">A. ${q.optionA}</div>
                <div class="option">B. ${q.optionB}</div>
                <div class="option">C. ${q.optionC}</div>
                <div class="option">D. ${q.optionD}</div>
            </div>
            <div style="margin-top: 15px;">
                <span class="user-answer">你的答案: ${q.userAnswer}</span>
                <span class="correct-answer">正确答案: ${q.answer}</span>
            </div>
            <div style="margin-top: 10px; color: #666; font-size: 0.9rem;">
                错误时间: ${new Date(q.timestamp).toLocaleString()}
            </div>
        </div>
    `).join('');
    
    wrongQuestionsContainer.innerHTML = html;
}

// 清空错题本
function clearWrongQuestions() {
    if (confirm('确定要清空错题本吗？此操作不可恢复。')) {
        wrongQuestions = [];
        localStorage.setItem('wrongQuestions', JSON.stringify(wrongQuestions));
        displayWrongQuestions();
        updateStats();
        showMessage('错题本已清空', 'success');
    }
}

// 更新统计信息
function updateStats() {
    document.getElementById('totalQuestionsCount').textContent = questions.length;
    document.getElementById('practicedCount').textContent = practiceStats.practiced;
    document.getElementById('wrongCount').textContent = wrongQuestions.length;
    
    const accuracy = practiceStats.practiced > 0 
        ? Math.round((practiceStats.correct / practiceStats.practiced) * 100)
        : 0;
    document.getElementById('accuracyRate').textContent = accuracy + '%';
}

// 工具函数：数组随机排序
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// 显示消息提示
function showMessage(message, type = 'info') {
    // 移除现有消息
    const existingMessage = document.querySelector('.message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    let messageClass = 'info-message';
    if (type === 'error') messageClass = 'error-message';
    else if (type === 'success') messageClass = 'success-message';
    else if (type === 'warning') messageClass = 'warning-message';
    
    messageDiv.className = `message ${messageClass}`;
    messageDiv.textContent = message;
    
    // 插入到导入区域
    const importSection = document.querySelector('.import-section');
    importSection.insertBefore(messageDiv, importSection.firstChild);
    
    // 3秒后自动移除
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, 3000);
}

// 添加搜索框回车事件
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchQuestions();
            }
        });
    }
});

// 添加键盘快捷键支持
document.addEventListener('keydown', function(e) {
    // 在考试模式下的快捷键
    if (document.getElementById('examContent').style.display !== 'none') {
        switch(e.key) {
            case 'ArrowLeft':
                e.preventDefault();
                prevQuestion();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextQuestion();
                break;
            case '1':
            case 'a':
            case 'A':
                if (e.ctrlKey || e.metaKey) break;
                selectOption('A');
                break;
            case '2':
            case 'b':
            case 'B':
                if (e.ctrlKey || e.metaKey) break;
                selectOption('B');
                break;
            case '3':
            case 'c':
            case 'C':
                if (e.ctrlKey || e.metaKey) break;
                selectOption('C');
                break;
            case '4':
            case 'd':
            case 'D':
                if (e.ctrlKey || e.metaKey) break;
                selectOption('D');
                break;
        }
    }
});

// 选择选项的辅助函数
function selectOption(option) {
    const radio = document.querySelector(`input[name="answer"][value="${option}"]`);
    if (radio) {
        radio.checked = true;
        radio.closest('.exam-option').click();
    }
}

// 自动加载同目录下的JSON文件
function autoLoadLocalJsonFiles() {
    // 常见的JSON文件名模式
    const commonJsonFiles = [
        'cisp-pte-questions-2025-07-01.json',
        'questions.json',
        'cisp-questions.json',
        'pte-questions.json',
        'exam-questions.json',
        'data.json'
    ];
    
    let loadedCount = 0;
    let totalAttempts = commonJsonFiles.length;
    
    showMessage('正在自动搜索同目录下的JSON题库文件...', 'info');
    
    // 尝试加载每个可能的JSON文件
    commonJsonFiles.forEach((filename, index) => {
        fetch(filename)
            .then(response => {
                if (response.ok) {
                    return response.json();
                } else {
                    throw new Error(`文件不存在: ${filename}`);
                }
            })
            .then(data => {
                // 验证JSON数据格式
                if (validateJsonData(data)) {
                    const questionsData = data.questions || data;
                    if (Array.isArray(questionsData) && questionsData.length > 0) {
                        // 标准化题目数据
                        const normalizedQuestions = questionsData.map((q, idx) => ({
                            id: idx + 1,
                            question: q.question?.toString() || '',
                            optionA: q.optionA?.toString() || '',
                            optionB: q.optionB?.toString() || '',
                            optionC: q.optionC?.toString() || '',
                            optionD: q.optionD?.toString() || '',
                            answer: (q.answer?.toString() || '').toUpperCase().trim()
                        })).filter(q => 
                            q.question && q.optionA && q.optionB && q.optionC && q.optionD && 
                            ['A', 'B', 'C', 'D'].includes(q.answer)
                        );
                        
                        if (normalizedQuestions.length > 0) {
                            questions = normalizedQuestions;
                            localStorage.setItem('questions', JSON.stringify(questions));
                            displayQuestions();
                            updateStats();
                            showMessage(`✅ 自动加载成功！从 "${filename}" 加载了 ${normalizedQuestions.length} 道题目`, 'success');
                            return; // 成功加载后停止尝试其他文件
                        }
                    }
                }
                throw new Error('数据格式不正确');
            })
            .catch(error => {
                loadedCount++;
                console.log(`尝试加载 ${filename} 失败:`, error.message);
                
                // 如果所有文件都尝试完毕且都失败了
                if (loadedCount === totalAttempts) {
                    showMessage('未找到可自动加载的JSON题库文件，请手动上传题库文件', 'warning');
                }
            });
    });
}

// 验证JSON数据格式
function validateJsonData(data) {
    // 支持直接的题目数组格式
    if (Array.isArray(data)) {
        return data.length > 0;
    }
    
    // 支持包含questions字段的配置对象
    if (data && typeof data === 'object' && Array.isArray(data.questions)) {
        return data.questions.length > 0;
    }
    
    return false;
}

// 错题练习功能
function startWrongQuestionsPractice() {
    if (wrongQuestions.length === 0) {
        showMessage('错题本为空，无法开始练习', 'warning');
        return;
    }
    
    // 确认开始错题练习
    if (!confirm(`确定要开始错题练习吗？\n共有 ${wrongQuestions.length} 道错题需要练习。`)) {
        return;
    }
    
    // 设置错题练习模式
    currentExam = {
        questions: shuffleArray(wrongQuestions),
        currentIndex: 0,
        answers: {},
        startTime: Date.now(),
        isWrongQuestionsPractice: true // 标记为错题练习模式
    };
    
    // 切换到考试页面
    document.querySelector('[data-tab="exam"]').click();
    
    // 显示考试界面
    document.getElementById('examSetup').style.display = 'none';
    document.getElementById('examContent').style.display = 'block';
    
    // 更新题目信息
    document.getElementById('totalQuestions').textContent = currentExam.questions.length;
    
    // 错题练习模式不需要计时器，隐藏计时器
    document.getElementById('timer').style.display = 'none';
    
    // 显示第一题
    showQuestion();
    
    // 更新考试标题
    const examTitle = document.querySelector('#examContent h2');
    if (examTitle) {
        examTitle.textContent = '错题练习模式';
    }
    
    showMessage('错题练习已开始！', 'success');
}

// ==================== 考试历史记录功能 ====================

// 显示考试历史记录
function showExamHistory() {
    const historyList = document.getElementById('historyList');
    
    if (examHistory.length === 0) {
        historyList.innerHTML = '<div class="no-data">暂无考试记录</div>';
        return;
    }
    
    const historyHtml = examHistory.map(record => {
        const date = new Date(record.date);
        const dateStr = date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        const passStatus = record.score >= 60 ? '通过' : '未通过';
        const passColor = record.score >= 60 ? '#28a745' : '#dc3545';
        
        return `
            <div class="history-item">
                <div class="history-item-header">
                    <div class="history-item-title">模拟考试 #${record.id.slice(-6)}</div>
                    <div class="history-item-date">${dateStr}</div>
                </div>
                <div class="history-item-stats">
                    <div class="history-stat">
                        <div class="history-stat-label">得分</div>
                        <div class="history-stat-value" style="color: ${passColor}">${record.score}分</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-label">状态</div>
                        <div class="history-stat-value" style="color: ${passColor}">${passStatus}</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-label">正确率</div>
                        <div class="history-stat-value">${record.correctCount}/${record.totalQuestions}</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-label">用时</div>
                        <div class="history-stat-value">${record.duration}分钟</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-label">错题数</div>
                        <div class="history-stat-value">${record.wrongCount}题</div>
                    </div>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-primary" onclick="viewExamDetail('${record.id}')">查看详情</button>
                    <button class="btn btn-secondary" onclick="retakeExam('${record.id}')">重做此卷</button>
                    <button class="btn btn-danger" onclick="deleteExamRecord('${record.id}')">删除记录</button>
                </div>
            </div>
        `;
    }).join('');
    
    historyList.innerHTML = historyHtml;
}

// 查看考试详情
function viewExamDetail(recordId) {
    const record = examHistory.find(r => r.id === recordId);
    if (!record) {
        showMessage('找不到考试记录', 'error');
        return;
    }
    
    const date = new Date(record.date);
    const dateStr = date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const questionsHtml = record.questions.map((q, index) => {
        const isCorrect = q.userAnswer === q.correctAnswer;
        const isUnanswered = q.userAnswer === '未作答';
        const statusClass = isUnanswered ? 'unanswered' : (isCorrect ? 'correct' : 'wrong');
        const statusText = isUnanswered ? '未作答' : (isCorrect ? '正确' : '错误');
        const statusColor = isUnanswered ? '#ffc107' : (isCorrect ? '#28a745' : '#dc3545');
        
        return `
            <div class="history-question-item ${statusClass}">
                <div class="history-question-content">
                    ${index + 1}. ${q.question}
                </div>
                <div class="history-question-options">
                    <div class="history-question-option ${q.correctAnswer === 'A' ? 'correct-answer' : ''} ${q.userAnswer === 'A' && q.userAnswer !== q.correctAnswer ? 'user-answer' : ''}">
                        A. ${q.optionA}
                    </div>
                    <div class="history-question-option ${q.correctAnswer === 'B' ? 'correct-answer' : ''} ${q.userAnswer === 'B' && q.userAnswer !== q.correctAnswer ? 'user-answer' : ''}">
                        B. ${q.optionB}
                    </div>
                    <div class="history-question-option ${q.correctAnswer === 'C' ? 'correct-answer' : ''} ${q.userAnswer === 'C' && q.userAnswer !== q.correctAnswer ? 'user-answer' : ''}">
                        C. ${q.optionC}
                    </div>
                    <div class="history-question-option ${q.correctAnswer === 'D' ? 'correct-answer' : ''} ${q.userAnswer === 'D' && q.userAnswer !== q.correctAnswer ? 'user-answer' : ''}">
                        D. ${q.optionD}
                    </div>
                </div>
                <div class="history-question-result">
                    <strong style="color: ${statusColor}">结果：${statusText}</strong><br>
                    正确答案：${q.correctAnswer} | 你的答案：${q.userAnswer}
                </div>
            </div>
        `;
    }).join('');
    
    const dialogHtml = `
        <div class="history-detail-dialog" onclick="closeHistoryDetail(event)">
            <div class="history-detail-content" onclick="event.stopPropagation()">
                <div class="history-detail-header">
                    <h3>考试详情 - ${dateStr}</h3>
                    <button class="history-detail-close" onclick="closeHistoryDetail()">×</button>
                </div>
                <div class="history-item-stats" style="margin-bottom: 20px;">
                    <div class="history-stat">
                        <div class="history-stat-label">得分</div>
                        <div class="history-stat-value">${record.score}分</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-label">正确率</div>
                        <div class="history-stat-value">${record.correctCount}/${record.totalQuestions}</div>
                    </div>
                    <div class="history-stat">
                        <div class="history-stat-label">用时</div>
                        <div class="history-stat-value">${record.duration}分钟</div>
                    </div>
                </div>
                <div class="history-detail-questions">
                    ${questionsHtml}
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', dialogHtml);
}

// 关闭考试详情弹窗
function closeHistoryDetail(event) {
    if (event && event.target !== event.currentTarget) return;
    const dialog = document.querySelector('.history-detail-dialog');
    if (dialog) {
        dialog.remove();
    }
}

// 重做考试
function retakeExam(recordId) {
    const record = examHistory.find(r => r.id === recordId);
    if (!record) {
        showMessage('找不到考试记录', 'error');
        return;
    }
    
    if (!confirm(`确定要重做这套试卷吗？\n题目数量：${record.totalQuestions}题`)) {
        return;
    }
    
    // 使用历史记录中的题目重新开始考试
    const examQuestions = record.questions.map(q => ({
        id: q.id,
        question: q.question,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        answer: q.correctAnswer
    }));
    
    // 设置考试参数
    currentExam = {
        questions: examQuestions,
        currentIndex: 0,
        answers: {},
        startTime: new Date(),
        timeLimit: 60, // 默认60分钟
        timer: null,
        isWrongQuestionsPractice: false
    };
    
    // 切换到考试页面
    document.querySelector('[data-tab="exam"]').click();
    
    // 开始考试
    setTimeout(() => {
        startExam();
    }, 100);
    
    showMessage('重做考试已开始！', 'success');
}

// 删除考试记录
function deleteExamRecord(recordId) {
    if (!confirm('确定要删除这条考试记录吗？此操作不可恢复。')) {
        return;
    }
    
    examHistory = examHistory.filter(r => r.id !== recordId);
    localStorage.setItem('examHistory', JSON.stringify(examHistory));
    
    showExamHistory(); // 刷新显示
    showMessage('考试记录已删除', 'success');
}

// 导出考试历史记录
function exportHistory() {
    if (examHistory.length === 0) {
        showMessage('暂无考试记录可导出', 'warning');
        return;
    }
    
    const exportData = {
        exportDate: new Date().toISOString(),
        totalRecords: examHistory.length,
        records: examHistory
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = `考试历史记录_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.json`;
    link.click();
    
    showMessage('考试记录导出成功', 'success');
}

// 清空考试历史记录
function clearHistory() {
    if (examHistory.length === 0) {
        showMessage('暂无考试记录', 'info');
        return;
    }
    
    if (!confirm(`确定要清空所有考试记录吗？\n当前共有 ${examHistory.length} 条记录，此操作不可恢复。`)) {
        return;
    }
    
    examHistory = [];
    localStorage.setItem('examHistory', JSON.stringify(examHistory));
    
    showExamHistory(); // 刷新显示
    showMessage('考试记录已清空', 'success');
}

// 切换到历史记录页面
function switchToHistoryTab() {
    // 移除所有标签页的活动状态
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    // 激活历史记录标签页
    const historyBtn = document.querySelector('[data-tab="history"]');
    const historyContent = document.getElementById('history');
    
    if (historyBtn && historyContent) {
        historyBtn.classList.add('active');
        historyContent.classList.add('active');
        showExamHistory(); // 显示历史记录
    }
}