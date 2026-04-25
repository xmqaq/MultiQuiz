// 通用工具函数

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

/**
 * 安全的 localStorage 存储，带容量检测
 */

function questionIdKey(questionId) {
    return String(questionId);
}

function normalizeQuestionContent(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function sanitizeCssToken(value) {
    return String(value || '')
        .trim()
        .replace(/[^\w\u4e00-\u9fa5-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);
}

function getQuestionAnswerValue(question) {
    return question?.answer ?? question?.correctAnswer ?? '';
}

function buildQuestionContentKey(question) {
    return [
        normalizeQuestionContent(question.question),
        normalizeQuestionContent(question.optionA),
        normalizeQuestionContent(question.optionB),
        normalizeQuestionContent(question.optionC),
        normalizeQuestionContent(question.optionD),
        normalizeQuestionContent(getQuestionAnswerValue(question)).toUpperCase()
    ].join('||');
}

function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function today() {
    return new Date().toISOString().split('T')[0];
}

function downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}
