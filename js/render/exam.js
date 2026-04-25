// 考试页渲染

function showQuestion() {
    const q = currentExam.questions[currentExam.currentIndex];
    const favored = isFavorited(q.id);
    document.getElementById('currentQuestion').textContent = currentExam.currentIndex + 1;

    const selectedAns = currentExam.answers[q.id];
    document.getElementById('questionContent').innerHTML = `
        <div class="q-card-top">
            <span class="q-card-index">${currentExam.currentIndex + 1}</span>
            <span class="q-card-subject">${escapeHtml(q._subjectName || currentExam.subjectName)}</span>
            <button class="icon-btn fav-btn q-card-fav ${favored ? 'active' : ''}" data-fav-id="${escapeHtml(String(q.id))}" onclick='toggleFavorite(${JSON.stringify(q.id)}, event)' title="${favored ? '取消收藏' : '收藏题目'}" aria-label="${favored ? '取消收藏' : '收藏题目'}" aria-pressed="${favored ? 'true' : 'false'}">${favoriteButtonIcon(favored)}</button>
        </div>
        <div class="q-exam-text">${escapeHtml(q.question)}</div>
        <div class="q-exam-options">
            ${['A','B','C','D'].map(opt => `
                <label class="q-exam-opt ${selectedAns === opt ? 'selected' : ''}">
                    <input type="radio" name="ans" value="${opt}" ${selectedAns === opt ? 'checked' : ''}>
                    <span class="opt-letter">${opt}</span>
                    <span class="opt-text">${escapeHtml(q['option' + opt])}</span>
                </label>
            `).join('')}
        </div>
    `;

    document.querySelectorAll('.q-exam-opt').forEach(label => {
        label.addEventListener('click', () => {
            const radio = label.querySelector('input');
            radio.checked = true;
            document.querySelectorAll('.q-exam-opt').forEach(l => l.classList.remove('selected'));
            label.classList.add('selected');
            currentExam.answers[q.id] = radio.value;
            saveExamSession();
            updateAnswerCard();
        });
    });

    const fill = document.getElementById('progressFill');
    if (fill) fill.style.width = ((currentExam.currentIndex + 1) / currentExam.questions.length * 100) + '%';
    
    updateAnswerCard();
}

// 答题卡

function updateAnswerCard() {
    const grid = document.getElementById('answerCardGrid');
    if (!grid || !currentExam.questions) return;

    grid.innerHTML = currentExam.questions.map((q, i) => {
        const isAnswered = currentExam.answers[q.id] !== undefined;
        const isCurrent = i === currentExam.currentIndex;
        const favored = isFavorited(q.id);
        return `
            <button class="answer-card-item ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''} ${favored ? 'favored' : ''}" onclick="jumpToQuestion(${i})" title="${favored ? '已收藏 - 点击跳转' : (i + 1)}">
                ${i + 1}
                ${favored ? '<span class="fav-star">★</span>' : ''}
            </button>
        `;
    }).join('');
}
