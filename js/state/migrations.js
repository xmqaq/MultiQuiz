// 历史数据修复、兼容处理和关联数据清理

function mergeQuestionTags(targetTags, questionId, tags) {
    const targetId = questionIdKey(questionId);
    const mergedTags = new Set(targetTags[targetId] || []);
    (tags || []).forEach(tag => {
        if (tag) mergedTags.add(tag);
    });
    if (mergedTags.size > 0) targetTags[targetId] = [...mergedTags];
}

function repairStoredQuestionReferencesAfterIdFix() {
    const seenIds = new Set();
    const remappedQuestions = [];

    subjects.forEach(subject => {
        subject.questions.forEach(question => {
            const currentId = questionIdKey(question.id);
            if (!question.id || seenIds.has(currentId)) {
                const newId = questionIdKey(genId());
                remappedQuestions.push({
                    oldId: currentId,
                    newId,
                    subjectId: subject.id,
                    contentKey: buildQuestionContentKey(question)
                });
                question.id = newId;
                seenIds.add(newId);
                return;
            }
            seenIds.add(currentId);
        });
    });

    if (remappedQuestions.length === 0) return false;

    const validQuestionIds = new Set();
    const questionIdBySubjectAndContent = new Map();
    subjects.forEach(subject => {
        subject.questions.forEach(question => {
            const questionId = questionIdKey(question.id);
            validQuestionIds.add(questionId);
            questionIdBySubjectAndContent.set(`${subject.id}::${buildQuestionContentKey(question)}`, questionId);
        });
    });

    const remappedTargetsByOldId = new Map();
    remappedQuestions.forEach(({ oldId, newId }) => {
        const key = questionIdKey(oldId);
        if (!remappedTargetsByOldId.has(key)) remappedTargetsByOldId.set(key, new Set());
        remappedTargetsByOldId.get(key).add(questionIdKey(newId));
    });

    const getRepairTargets = oldId => {
        const key = questionIdKey(oldId);
        const targets = new Set(remappedTargetsByOldId.get(key) || []);
        if (validQuestionIds.has(key)) targets.add(key);
        return targets;
    };

    const nextQuestionTags = {};
    Object.entries(questionTags || {}).forEach(([questionId, tags]) => {
        const targets = getRepairTargets(questionId);
        if (targets.size === 0) return;
        targets.forEach(targetId => mergeQuestionTags(nextQuestionTags, targetId, tags));
    });
    questionTags = nextQuestionTags;

    const nextFavorites = new Set();
    favoriteSet.forEach(questionId => {
        const targets = getRepairTargets(questionId);
        targets.forEach(targetId => nextFavorites.add(targetId));
    });
    favoriteSet = nextFavorites;

    const latestWrongByQuestion = new Map();
    wrongQuestions.forEach(record => {
        const contentKey = buildQuestionContentKey(record);
        const exactId = questionIdBySubjectAndContent.get(`${record.subjectId}::${contentKey}`);
        const fallbackId = validQuestionIds.has(questionIdKey(record.id)) ? questionIdKey(record.id) : [...getRepairTargets(record.id)][0];
        const nextId = exactId || fallbackId;
        if (!nextId) return;

        const normalizedRecord = { ...record, id: nextId };
        const prev = latestWrongByQuestion.get(nextId);
        const prevTime = prev ? new Date(prev.timestamp || 0).getTime() : -Infinity;
        const currTime = new Date(normalizedRecord.timestamp || 0).getTime();
        if (!prev || currTime >= prevTime) {
            latestWrongByQuestion.set(nextId, normalizedRecord);
        }
    });
    wrongQuestions = [...latestWrongByQuestion.values()];

    examHistory = examHistory.map(record => ({
        ...record,
        questions: Array.isArray(record.questions)
            ? record.questions
                .map(question => {
                    const questionSubjectId = question.subjectId || record.subjectId;
                    const contentKey = buildQuestionContentKey(question);
                    const exactId = questionIdBySubjectAndContent.get(`${questionSubjectId}::${contentKey}`);
                    const fallbackId = validQuestionIds.has(questionIdKey(question.id)) ? questionIdKey(question.id) : [...getRepairTargets(question.id)][0];
                    const nextId = exactId || fallbackId;
                    return nextId ? { ...question, id: nextId } : null;
                })
                .filter(Boolean)
            : record.questions
    }));

    saveSubjects();
    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
    safeSetItem('examHistory', JSON.stringify(examHistory));
    safeSetItem('questionTags', JSON.stringify(questionTags));
    saveFavorites();
    return true;
}

function normalizePracticeLogEntry(entry) {
    const totalQuestions = Number(entry?.totalQuestions) || 0;
    if (totalQuestions <= 0) return null;

    const parsedDate = new Date(entry?.date || Date.now());
    const date = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
    const correct = Math.max(0, Math.min(totalQuestions, Number(entry?.correct) || 0));
    const mode = ['exam', 'wrong', 'legacy'].includes(entry?.mode) ? entry.mode : 'exam';

    return {
        id: String(entry?.id || genId()),
        sessionId: String(entry?.sessionId || entry?.sourceExamRecordId || genId()),
        date,
        subjectId: entry?.subjectId ? String(entry.subjectId) : '',
        subjectName: entry?.subjectName ? String(entry.subjectName) : '',
        totalQuestions,
        correct,
        mode,
        sourceExamRecordId: entry?.sourceExamRecordId ? String(entry.sourceExamRecordId) : ''
    };
}

function buildPracticeLogEntriesFromExamRecord(record) {
    if (!record) return [];

    const sessionId = String(record.id || genId());
    if (Array.isArray(record.questions) && record.questions.some(question => question?.subjectId)) {
        const subjectSummary = new Map();
        record.questions.forEach(question => {
            const subjectId = question?.subjectId ? String(question.subjectId) : '';
            const subjectName = question?.subjectName || '';
            if (!subjectId) return;

            if (!subjectSummary.has(subjectId)) {
                subjectSummary.set(subjectId, {
                    id: genId(),
                    sessionId,
                    date: record.date,
                    subjectId,
                    subjectName,
                    totalQuestions: 0,
                    correct: 0,
                    mode: 'exam',
                    sourceExamRecordId: sessionId
                });
            }

            const summary = subjectSummary.get(subjectId);
            summary.totalQuestions += 1;
            if (question.userAnswer === question.correctAnswer) {
                summary.correct += 1;
            }
        });
        return [...subjectSummary.values()].map(normalizePracticeLogEntry).filter(Boolean);
    }

    const fallbackEntry = normalizePracticeLogEntry({
        id: genId(),
        sessionId,
        date: record.date,
        subjectId: record.subjectId,
        subjectName: record.subjectName,
        totalQuestions: Number(record.totalQuestions) || 0,
        correct: Number(record.correct) || 0,
        mode: 'exam',
        sourceExamRecordId: sessionId
    });
    return fallbackEntry ? [fallbackEntry] : [];
}

function getPracticeLogSummary(records = practiceLog) {
    return records.reduce((summary, record) => {
        summary.practiced += Number(record?.totalQuestions) || 0;
        summary.correct += Number(record?.correct) || 0;
        return summary;
    }, { practiced: 0, correct: 0 });
}

function getTrackedPracticeLogRecords(includeLegacy = false) {
    return includeLegacy ? [...practiceLog] : practiceLog.filter(record => record.mode !== 'legacy');
}

function syncPracticeStatsFromPracticeLog() {
    const summary = getPracticeLogSummary();
    practiceStats = {
        total: 0,
        correct: summary.correct,
        practiced: summary.practiced
    };
}

function trimPracticeLog() {
    const legacyRecords = practiceLog.filter(record => record.mode === 'legacy').slice(0, 1);
    const trackedRecords = practiceLog
        .filter(record => record.mode !== 'legacy')
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 1000);
    practiceLog = [...legacyRecords, ...trackedRecords];
}

function persistPracticeTracking() {
    practiceLog = (Array.isArray(practiceLog) ? practiceLog : [])
        .map(normalizePracticeLogEntry)
        .filter(Boolean);
    trimPracticeLog();
    syncPracticeStatsFromPracticeLog();
    safeSetItem('practiceLog', JSON.stringify(practiceLog));
    safeSetItem('practiceStats', JSON.stringify(practiceStats));
}

function ensurePracticeLogConsistency() {
    practiceLog = Array.isArray(practiceLog)
        ? practiceLog.map(normalizePracticeLogEntry).filter(Boolean)
        : [];

    if (practiceLog.length === 0) {
        practiceLog = examHistory.flatMap(record => buildPracticeLogEntriesFromExamRecord(record));
    }

    persistPracticeTracking();
}

function buildPracticeLogEntriesFromQuestions(questions, answers, mode, sessionId, fallbackSubjectId, fallbackSubjectName, sourceExamRecordId = '') {
    const subjectSummary = new Map();

    questions.forEach(question => {
        const subjectId = String(question?._subjectId || question?.subjectId || fallbackSubjectId || '');
        const subjectName = String(question?._subjectName || question?.subjectName || fallbackSubjectName || '');
        const key = `${subjectId}::${subjectName}`;
        if (!subjectSummary.has(key)) {
            subjectSummary.set(key, {
                id: genId(),
                sessionId,
                date: new Date().toISOString(),
                subjectId,
                subjectName,
                totalQuestions: 0,
                correct: 0,
                mode,
                sourceExamRecordId
            });
        }

        const summary = subjectSummary.get(key);
        summary.totalQuestions += 1;
        if ((answers || {})[question.id] === question.answer) {
            summary.correct += 1;
        }
    });

    return [...subjectSummary.values()].map(normalizePracticeLogEntry).filter(Boolean);
}

function collectLibraryDedupData() {
    const firstQuestionByContent = new Map();
    const duplicateTargets = new Map();
    const removedBySubject = new Map();

    subjects.forEach(subject => {
        subject.questions.forEach(question => {
            const contentKey = buildQuestionContentKey(question);
            const questionKey = questionIdKey(question.id);
            const first = firstQuestionByContent.get(contentKey);

            if (!first) {
                firstQuestionByContent.set(contentKey, {
                    id: questionKey,
                    subjectId: subject.id,
                    subjectName: subject.name
                });
                return;
            }

            duplicateTargets.set(questionKey, first);
            removedBySubject.set(subject.id, (removedBySubject.get(subject.id) || 0) + 1);
        });
    });

    return {
        duplicateCount: duplicateTargets.size,
        duplicateTargets,
        removedBySubject
    };
}

function resetExamStateAfterLibraryChange() {
    const hadRuntimeExam = Array.isArray(currentExam?.questions) && currentExam.questions.length > 0;
    const hadSavedExam = !!sessionStorage.getItem('currentExam');

    if (currentExam?.timer) clearTimeout(currentExam.timer);
    currentExam = {};
    _pendingSwitchTab = null;
    _examLeaveConfirmed = false;
    clearExamSession();

    const examSetup = document.getElementById('examSetup');
    const examContent = document.getElementById('examContent');
    const examNav = document.querySelector('.exam-nav');
    const timer = document.getElementById('timer');
    const answerCardPanel = document.getElementById('answerCardPanel');

    if (examSetup) examSetup.style.display = 'block';
    if (examContent) examContent.style.display = 'none';
    if (examNav) examNav.style.display = 'flex';
    if (answerCardPanel) answerCardPanel.style.display = 'none';
    if (timer) {
        timer.style.display = 'block';
        timer.style.color = '';
        timer.textContent = '60:00';
    }

    updateExamInteractionState();
    updateExamSubjectSelect();
    onExamSubjectChange();
    return hadRuntimeExam || hadSavedExam;
}

function clearSubjectAssociatedData(subject) {
    if (!subject) {
        return {
            removedWrongCount: 0,
            removedHistoryCount: 0,
            hadExamSession: resetExamStateAfterLibraryChange()
        };
    }

    const subjectId = subject.id;
    const subjectQuestionIds = new Set(subject.questions.map(q => String(q.id)));
    const subjectExamRecords = examHistory.filter(record =>
        record.subjectId === subjectId ||
        (Array.isArray(record.questions) && record.questions.some(question => (question.subjectId || record.subjectId) === subjectId))
    );
    const removedExamRecordIds = new Set(subjectExamRecords.map(record => String(record.id)));

    const removedWrongCount = wrongQuestions.filter(q => q.subjectId === subjectId).length;
    wrongQuestions = wrongQuestions.filter(q => q.subjectId !== subjectId);
    examHistory = examHistory.filter(record => !subjectExamRecords.includes(record));
    practiceLog = practiceLog.filter(record =>
        record.subjectId !== subjectId &&
        (!record.sourceExamRecordId || !removedExamRecordIds.has(String(record.sourceExamRecordId)))
    );

    for (const qid of Object.keys(questionTags)) {
        if (subjectQuestionIds.has(qid)) {
            delete questionTags[qid];
        }
    }

    favoriteSet.forEach(id => {
        if (subjectQuestionIds.has(id)) favoriteSet.delete(id);
    });

    normalizePracticeStatsIfNoTrackedData();
    safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
    safeSetItem('examHistory', JSON.stringify(examHistory));
    safeSetItem('questionTags', JSON.stringify(questionTags));
    persistPracticeTracking();
    saveFavorites();

    return {
        removedWrongCount,
        removedHistoryCount: subjectExamRecords.length,
        hadExamSession: resetExamStateAfterLibraryChange()
    };
}
