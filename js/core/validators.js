// 导入题目格式校验

function normalizeImportedQuestion(rawQuestion) {
    const answer = (getQuestionAnswerValue(rawQuestion) || '').toString().toUpperCase().trim();
    const normalized = {
        id: genId(),
        question: String(rawQuestion?.question ?? '').trim(),
        optionA: String(rawQuestion?.optionA ?? '').trim(),
        optionB: String(rawQuestion?.optionB ?? '').trim(),
        optionC: String(rawQuestion?.optionC ?? '').trim(),
        optionD: String(rawQuestion?.optionD ?? '').trim(),
        answer
    };

    const isValid = Boolean(
        normalized.question &&
        normalized.optionA &&
        normalized.optionB &&
        normalized.optionC &&
        normalized.optionD &&
        ['A', 'B', 'C', 'D'].includes(answer)
    );

    return isValid ? normalized : null;
}
