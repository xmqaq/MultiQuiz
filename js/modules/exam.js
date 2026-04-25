// 模拟答题、会话恢复、重做此卷

function updateExamSubjectSelect() {
    const sel = document.getElementById('examSubject');
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="all">全部学科</option>';
    subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        sel.appendChild(opt);
    });
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
}

function onExamSubjectChange() {
    const sel = document.getElementById('examSubject');
    const hint = document.getElementById('examSubjectHint');
    if (!sel || !hint) return;
    const val = sel.value;
    let count = 0;
    if (val === 'all') {
        count = subjects.reduce((n, s) => n + s.questions.length, 0);
    } else {
        const s = subjects.find(s => s.id === val);
        count = s ? s.questions.length : 0;
    }
    hint.textContent = `共 ${count} 道题`;
}

function startExam() {
    closeAnswerCardOnMobile(false);
    const subjectVal = document.getElementById('examSubject').value;
    const examCount = document.getElementById('examCount').value;
    const examTime = parseInt(document.getElementById('examTime').value);

    // 智能推题选项
    const smartWrongFirst = document.getElementById('smartWrongFirst')?.checked || false;
    const smartWeighted = document.getElementById('smartWeighted')?.checked || false;
    const smartTagged = document.getElementById('smartTagged')?.checked || false;
    const examFavoritesOnly = document.getElementById('examFavoritesOnly')?.checked || false;

    let pool = [];
    let subjectName = '全部学科';
    if (subjectVal === 'all') {
        subjects.forEach(s => s.questions.forEach(q => pool.push({ ...q, _subjectId: s.id, _subjectName: s.name })));
    } else {
        const s = subjects.find(s => s.id === subjectVal);
        if (!s) { showToast('请先导入题库', 'error'); return; }
        pool = s.questions.map(q => ({ ...q, _subjectId: s.id, _subjectName: s.name }));
        subjectName = s.name;
    }

    if (examFavoritesOnly) {
        pool = pool.filter(q => isFavorited(q.id));
        subjectName += ' · 收藏题';
    }

    if (pool.length === 0) {
        if (examFavoritesOnly) showToast('当前范围内没有收藏题目，请先标星后再练习', 'warning');
        else showToast('该学科暂无题目，请先导入', 'error');
        return;
    }

    // 智能推题处理
    let examQuestions;
    if (smartWrongFirst || smartWeighted || smartTagged) {
        examQuestions = smartSelectQuestions(pool, examCount === 'all' ? pool.length : parseInt(examCount), {
            wrongFirst: smartWrongFirst,
            weighted: smartWeighted,
            tagged: smartTagged
        });
    } else {
        examQuestions = shuffleArray(pool);
        if (examCount !== 'all') {
            const n = parseInt(examCount);
            if (n > pool.length) {
                showToast(`题库只有 ${pool.length} 道题，已自动调整为全部题目`, 'warning');
            } else {
                examQuestions = examQuestions.slice(0, n);
            }
        }
    }

    currentExam = {
        questions: examQuestions,
        currentIndex: 0,
        answers: {},
        startTime: new Date(),
        effectiveStart: new Date(),
        timeLimit: examTime,
        timer: null,
        subjectId: subjectVal,
        subjectName,
        isWrongPractice: false,
        timeLeft: examTime * 60,
        endTime: Date.now() + examTime * 60 * 1000
    };

    updateExamInteractionState();
    saveExamSession();

    document.getElementById('examSetup').style.display = 'none';
    document.getElementById('examContent').style.display = 'block';
    document.getElementById('totalQuestions').textContent = examQuestions.length;
    document.getElementById('examSubjectTag').textContent = subjectName;
    document.getElementById('timer').style.display = 'block';
    document.getElementById('timer').style.color = '';

    startTimer();
    showQuestion();
}

// 智能推题算法
function smartSelectQuestions(pool, count, options) {
    const { wrongFirst, weighted, tagged } = options;

    // 计算每道题的权重
    const weightedPool = pool.map(q => {
        let weight = 1;

        // 错题权重提高
        if (wrongFirst && wrongQuestions.some(w => w.id === q.id)) {
            weight += 5;
        }

        // 标记为"需复习"的题目权重提高
        if (tagged && questionTags[q.id]?.includes('需复习')) {
            weight += 3;
        }

        // 加权抽题：根据正确率调整
        if (weighted) {
            // 根据错题次数降低权重（错得越多，权重越高，越容易被抽到）
            const wrongCount = wrongQuestions.filter(w => w.id === q.id).length;
            weight += wrongCount * 2;
        }

        return { ...q, weight };
    });

    // 按权重排序（高权重在前）
    weightedPool.sort((a, b) => b.weight - a.weight);

    // 加权随机抽取
    const selected = [];
    const remaining = [...weightedPool];
    const targetCount = Math.min(count, pool.length);

    while (selected.length < targetCount && remaining.length > 0) {
        // 计算总权重
        const totalWeight = remaining.reduce((sum, q) => sum + q.weight, 0);

        // 随机选择（权重越高，概率越大）
        let rand = Math.random() * totalWeight;
        let selectedIdx = 0;

        for (let i = 0; i < remaining.length; i++) {
            rand -= remaining[i].weight;
            if (rand <= 0) {
                selectedIdx = i;
                break;
            }
        }

        selected.push(remaining[selectedIdx]);
        remaining.splice(selectedIdx, 1);
    }

    // 打乱顺序
    return shuffleArray(selected);
}

function startTimer() {
    // 使用绝对结束时间，确保刷新/关闭页面后恢复时仍按真实时间流逝计时
    if (!currentExam.endTime) {
        const totalSeconds = currentExam.timeLeft ?? currentExam.timeLimit * 60;
        currentExam.endTime = Date.now() + totalSeconds * 1000;
    }

    function updateTimer() {
        const remaining = Math.max(0, Math.floor((currentExam.endTime - Date.now()) / 1000));
        const m = Math.floor(remaining / 60);
        const s = remaining % 60;
        document.getElementById('timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if (remaining <= 300) document.getElementById('timer').style.color = '#ef4444';

        if (remaining <= 0) {
            submitExam();
            return;
        }

        currentExam.timeLeft = remaining;
        if (remaining % 10 === 0) saveExamSession();
        currentExam.timer = setTimeout(updateTimer, 1000);
    }

    updateTimer();
}

function toggleAnswerCard(forceOpen) {
    const panel = document.getElementById('answerCardPanel');
    const toggleBtn = document.getElementById('answerCardToggleBtn');
    if (!panel || isExamCompleted()) return;

    const isHidden = panel.style.display === 'none' || getComputedStyle(panel).display === 'none';
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;

    if (shouldOpen) {
        panel.style.display = 'block';
        updateAnswerCard();
        if (isMobileLayout()) document.body.classList.add('answer-card-open');
    } else {
        panel.style.display = 'none';
        document.body.classList.remove('answer-card-open');
    }

    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
}

function jumpToQuestion(index) {
    if (isExamCompleted()) return;
    if (index >= 0 && index < currentExam.questions.length) {
        currentExam.currentIndex = index;
        showQuestion();
        saveExamSession();
        if (isMobileLayout()) closeAnswerCardOnMobile();
    }
}

function prevQuestion() {
    if (isExamCompleted()) return;
    if (currentExam.currentIndex > 0) { currentExam.currentIndex--; showQuestion(); saveExamSession(); }
}
function nextQuestion() {
    if (isExamCompleted()) return;
    if (currentExam.currentIndex < currentExam.questions.length - 1) { currentExam.currentIndex++; showQuestion(); saveExamSession(); }
}

function submitExam() {
    if (currentExam.timer) clearTimeout(currentExam.timer);
    closeAnswerCardOnMobile(false);
    currentExam.completed = true;
    updateExamInteractionState();
    clearExamSession();
    const newWrong = [];
    const corrected = [];
    let correct = 0;

    currentExam.questions.forEach(q => {
        const ua = currentExam.answers[q.id];
        if (ua === q.answer) {
            correct++;
            if (currentExam.isWrongPractice) corrected.push(q.id);
        } else {
            if (!currentExam.isWrongPractice) {
                newWrong.push({
                    ...q,
                    subjectId: q._subjectId || currentExam.subjectId,
                    subjectName: q._subjectName || currentExam.subjectName,
                    userAnswer: ua || '未作答',
                    timestamp: new Date().toISOString()
                });
            }
        }
    });

    if (currentExam.isWrongPractice) {
        wrongQuestions = wrongQuestions.filter(q => !corrected.includes(q.id));
    } else {
        // 答对的题从错题本移除
        const answeredCorrectIds = new Set(
            currentExam.questions
                .filter(q => currentExam.answers[q.id] === q.answer)
                .map(q => q.id)
        );
        wrongQuestions = wrongQuestions.filter(q => !answeredCorrectIds.has(q.id));
        // 答错的题：去重后追加（保持最新一次）
        const newWrongIds = new Set(newWrong.map(q => q.id));
        wrongQuestions = wrongQuestions.filter(q => !newWrongIds.has(q.id));
        wrongQuestions = [...wrongQuestions, ...newWrong];
    }
    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));

    const score = Math.round(correct / currentExam.questions.length * 100);
    const duration = Math.round((new Date() - (currentExam.effectiveStart || currentExam.startTime)) / 1000 / 60);
    const sessionId = genId();
    const submittedAt = new Date().toISOString();
    const practiceEntries = buildPracticeLogEntriesFromQuestions(
        currentExam.questions,
        currentExam.answers,
        currentExam.isWrongPractice ? 'wrong' : 'exam',
        sessionId,
        currentExam.subjectId,
        currentExam.subjectName,
        currentExam.isWrongPractice ? '' : sessionId
    ).map(entry => ({ ...entry, date: submittedAt }));

    if (!currentExam.isWrongPractice) {
        const record = {
            id: sessionId,
            date: submittedAt,
            score, correct,
            totalQuestions: currentExam.questions.length,
            duration,
            timeLimit: currentExam.timeLimit,
            wrongCount: newWrong.length,
            subjectId: currentExam.subjectId,
            subjectName: currentExam.subjectName,
            questions: currentExam.questions.map(q => ({
                id: q.id,
                question: q.question,
                optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
                subjectId: q._subjectId || q.subjectId || currentExam.subjectId,
                subjectName: q._subjectName || q.subjectName || currentExam.subjectName,
                correctAnswer: q.answer,
                userAnswer: currentExam.answers[q.id] || '未作答'
            }))
        };
        examHistory.unshift(record);
        if (examHistory.length > 50) examHistory = examHistory.slice(0, 50);
        safeSetItem('examHistory', JSON.stringify(examHistory));
    }

    practiceLog = [...practiceEntries, ...practiceLog];
    persistPracticeTracking();

    updateStats();
    displayWrongQuestions();

    const scoreColor = score >= 60 ? '#10b981' : '#ef4444';
    const isPass = score >= 60;

    if (currentExam.isWrongPractice) {
        document.getElementById('questionContent').innerHTML = `
            <div class="result-panel">
                <div class="result-icon">${score >= 80 ? '🎉' : '📚'}</div>
                <div class="result-score" style="color:${scoreColor}">${score}分</div>
                <div class="result-title">错题练习完成</div>
                <div class="result-details">
                    <div class="result-stat"><span>${currentExam.questions.length}</span>练习题目</div>
                    <div class="result-stat"><span>${correct}</span>答对</div>
                    <div class="result-stat"><span>${corrected.length}</span>已掌握</div>
                    <div class="result-stat"><span>${currentExam.questions.length - correct}</span>仍需练习</div>
                </div>
                <div class="result-btns">
                    <button class="btn btn-primary" onclick="startWrongQuestionsPractice()">继续练习</button>
                    <button class="btn btn-ghost" onclick="restartExam()">返回设置</button>
                </div>
            </div>
        `;
    } else {
        document.getElementById('questionContent').innerHTML = `
            <div class="result-panel">
                <div class="result-icon">${isPass ? '🎉' : '💪'}</div>
                <div class="result-score" style="color:${scoreColor}">${score}分</div>
                <div class="result-title">${isPass ? '恭喜通过！' : '继续加油！'}</div>
                <div class="result-details">
                    <div class="result-stat"><span>${correct}/${currentExam.questions.length}</span>正确题数</div>
                    <div class="result-stat"><span>${duration}</span>分钟用时</div>
                    <div class="result-stat"><span>${newWrong.length}</span>错题数</div>
                </div>
                <div class="result-btns">
                    <button class="btn btn-primary" onclick="restartExam()">再考一次</button>
                    ${newWrong.length > 0 ? '<button class="btn btn-warning" onclick="startWrongQuestionsPractice()">练习错题</button>' : ''}
                    <button class="btn btn-ghost" onclick="switchTab(\'history\')">查看记录</button>
                </div>
            </div>
        `;
    }
    document.querySelector('.exam-nav').style.display = 'none';
}

function restartExam() {
    closeAnswerCardOnMobile(false);
    clearExamSession();
    currentExam = {};
    updateExamInteractionState();
    document.getElementById('examSetup').style.display = 'block';
    document.getElementById('examContent').style.display = 'none';
    document.querySelector('.exam-nav').style.display = 'flex';
    document.getElementById('timer').style.color = '';
    updateExamSubjectSelect();
    onExamSubjectChange();
}

function saveExamSession() {
    if (!currentExam || !currentExam.questions) return;
    const session = {
        questions: currentExam.questions,
        currentIndex: currentExam.currentIndex,
        answers: currentExam.answers,
        startTime: currentExam.startTime,
        effectiveStart: currentExam.effectiveStart,
        timeLimit: currentExam.timeLimit,
        timeLeft: currentExam.timeLeft,
        endTime: currentExam.endTime || null,
        savedAt: Date.now(),
        subjectId: currentExam.subjectId,
        subjectName: currentExam.subjectName,
        isWrongPractice: currentExam.isWrongPractice
    };
    sessionStorage.setItem('currentExam', JSON.stringify(session));
}

function clearExamSession() {
    sessionStorage.removeItem('currentExam');
}

function restoreExamSession() {
    const saved = sessionStorage.getItem('currentExam');
    if (!saved) return;
    try {
        const session = JSON.parse(saved);
        if (!session.questions || session.questions.length === 0) { clearExamSession(); return; }

        // 检查考试时间是否已过期（非错题练习）
        if (!session.isWrongPractice) {
            let remainingSeconds = null;
            const now = Date.now();

            if (typeof session.endTime === 'number') {
                remainingSeconds = Math.max(0, Math.floor((session.endTime - now) / 1000));
            } else if (session.timeLeft !== undefined) {
                const elapsedSinceSave = typeof session.savedAt === 'number'
                    ? Math.max(0, Math.floor((now - session.savedAt) / 1000))
                    : 0;
                remainingSeconds = Math.max(0, Number(session.timeLeft) - elapsedSinceSave);
                session.endTime = now + remainingSeconds * 1000;
            }

            if (remainingSeconds !== null) {
                session.timeLeft = remainingSeconds;
            }

            if (session.timeLeft !== undefined && session.timeLeft <= 0) {
                clearExamSession();
                showToast('上次考试时间已用完，已自动清除', 'info');
                return;
            }
        }

        showConfirmWithOptions('检测到上次未完成的考试，是否继续？', [
            {
                label: '继续答题',
                action: () => {
                    currentExam = {
                        ...session,
                        timer: null,
                        startTime: new Date(session.startTime),
                        effectiveStart: new Date(session.effectiveStart || session.startTime),
                        completed: false
                    };
                    closeAnswerCardOnMobile(false);
                    updateExamInteractionState();
                    switchTab('exam');
                    document.getElementById('examSetup').style.display = 'none';
                    document.getElementById('examContent').style.display = 'block';
                    document.getElementById('totalQuestions').textContent = currentExam.questions.length;
                    document.getElementById('examSubjectTag').textContent = currentExam.subjectName;
                    if (currentExam.isWrongPractice) {
                        document.getElementById('timer').style.display = 'none';
                    } else {
                        document.getElementById('timer').style.display = 'block';
                        startTimer();
                    }
                    showQuestion();
                }
            },
            { label: '放弃考试', danger: true, action: () => { clearExamSession(); } }
        ]);
    } catch (e) {
        clearExamSession();
    }
}
