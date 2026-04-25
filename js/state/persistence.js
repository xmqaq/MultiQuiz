// 安全存储与持久化

function safeSetItem(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            showToast('存储空间不足，请导出备份后清理部分数据', 'error');
        } else {
            showToast('数据保存失败：' + e.message, 'error');
        }
        return false;
    }
}

/**
 * 获取 localStorage 可用空间估算（字节）
 */
function getStorageAvailable() {
    let used = 0;
    for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
            used += localStorage[key].length * 2; // UTF-16 编码
        }
    }
    return { used, limit: 5 * 1024 * 1024 }; // 假设 5MB 限制
}

function parseStorageJSON(key, fallbackValue) {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackValue;
    try {
        return JSON.parse(raw);
    } catch (e) {
        console.warn(`localStorage 数据损坏: ${key}`, e);
        showToast(`本地数据 ${key} 已损坏，已使用默认值`, 'warning');
        return fallbackValue;
    }
}

function loadData() {
    // 加载 subjects（新格式）
    const savedSubjects = localStorage.getItem('subjects');
    if (savedSubjects) {
        subjects = parseStorageJSON('subjects', []);
    } else {
        // 迁移旧数据：把旧的 questions[] 迁移为"网络安全"学科
        const oldQuestions = parseStorageJSON('questions', null);
        if (oldQuestions) {
            const qs = oldQuestions;
            if (qs && qs.length > 0) {
                subjects = [{
                    id: genId(),
                    name: '网络安全',
                    questions: qs
                }];
                saveSubjects();
                showToast(`已将原有 ${qs.length} 道题迁移至「网络安全」学科`, 'info');
            }
        }
    }

    wrongQuestions = parseStorageJSON('wrongQuestions', []);
    practiceStats = parseStorageJSON('practiceStats', { total: 0, correct: 0, practiced: 0 });
    examHistory = parseStorageJSON('examHistory', []);
    practiceLog = parseStorageJSON('practiceLog', []);
    questionTags = parseStorageJSON('questionTags', {});
    favoriteQuestionIds = parseStorageJSON('favoriteQuestionIds', []);
    browseAnswerMode = parseStorageJSON(BROWSE_ANSWER_MODE_KEY, 'show') === 'hide' ? 'hide' : 'show';
    if (!Array.isArray(favoriteQuestionIds)) favoriteQuestionIds = [];
    favoriteSet = new Set(favoriteQuestionIds.map(id => String(id)));

    repairStoredQuestionReferencesAfterIdFix();
    ensurePracticeLogConsistency();
    cleanupOrphanFavorites();
}


function saveSubjects() {
    safeSetItem('subjects', JSON.stringify(subjects));
}

function saveFavorites() {
    favoriteQuestionIds = [...favoriteSet];
    safeSetItem('favoriteQuestionIds', JSON.stringify(favoriteQuestionIds));
}
