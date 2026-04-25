// 整体备份与恢复

function exportAllBackup() {
    const backup = {
        version: '2.0',
        timestamp: new Date().toISOString(),
        exportDate: new Date().toLocaleString('zh-CN'),
        subjects: subjects,
        wrongQuestions: wrongQuestions,
        practiceStats: practiceStats,
        examHistory: examHistory,
        practiceLog: practiceLog,
        questionTags: questionTags,
        favoriteQuestionIds: [...favoriteSet]
    };
    downloadJson(backup, `多学科题库-完整备份-${today()}.json`);
    showToast('配置已备份导出，包含题库、错题本、标签、收藏、练习统计和考试记录', 'success');
}

function restoreFromBackup(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => showToast('文件读取失败', 'error');
    reader.onload = e => {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.version || backup.version !== '2.0') {
                showToast('备份文件格式不兼容', 'error');
                return;
            }
            showConfirmWithOptions('确定要导入备份配置？<br>将覆盖当前的所有题库、错题本和练习记录。', [
                {
                    label: '确认导入',
                    danger: true,
                    action: () => {
                        subjects = backup.subjects || [];
                        wrongQuestions = backup.wrongQuestions || [];
                        practiceStats = backup.practiceStats || { total: 0, correct: 0, practiced: 0 };
                        examHistory = backup.examHistory || [];
                        practiceLog = backup.practiceLog || [];
                        questionTags = (backup.questionTags && typeof backup.questionTags === 'object' && !Array.isArray(backup.questionTags))
                            ? backup.questionTags
                            : {};
                        favoriteQuestionIds = Array.isArray(backup.favoriteQuestionIds) ? backup.favoriteQuestionIds.map(id => String(id)) : [];
                        favoriteSet = new Set(favoriteQuestionIds);
                        saveSubjects();
                        safeSetItem('wrongQuestions', JSON.stringify(wrongQuestions));
                        safeSetItem('examHistory', JSON.stringify(examHistory));
                        safeSetItem('questionTags', JSON.stringify(questionTags));
                        ensurePracticeLogConsistency();
                        saveFavorites();
                        const hadExamSession = resetExamStateAfterLibraryChange();
                        renderAll();
                        showToast(`配置已恢复！包含 ${subjects.length} 个学科、${wrongQuestions.length} 条错题${hadExamSession ? '，并清除了未完成考试缓存' : ''}`, 'success');
                    }
                },
                { label: '取消', ghost: true, action: () => {} }
            ], true);
        } catch (err) {
            showToast('备份文件解析失败：' + err.message, 'error');
        }
    };
    reader.readAsText(file, 'utf-8');
    fileInput.value = '';
}
