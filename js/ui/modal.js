// 弹窗 / 确认框

function showModal(html, large = false) {
    const overlay = document.getElementById('modalOverlay');
    const box = document.getElementById('modalBox');
    box.className = 'modal-box' + (large ? ' modal-large' : '');
    box.innerHTML = html;
    overlay.style.display = 'flex';
    // 聚焦到模态框以支持键盘导航
    overlay.focus();
    // 添加 ESC 键关闭支持
    overlay.addEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(e) {
    if (e.key === 'Escape') {
        closeModal();
    }
}

function closeModal(e) {
    if (e && e.target !== document.getElementById('modalOverlay')) return;
    const overlay = document.getElementById('modalOverlay');
    overlay.style.display = 'none';
    overlay.removeEventListener('keydown', handleModalKeydown);
    modalCallbacks = {};
}

function executeModalCallback(id) {
    if (modalCallbacks[id]) {
        const fn = modalCallbacks[id];
        closeModal();
        fn();
    }
}

function formatConfirmMessage(message, allowHtml = false) {
    if (allowHtml) return String(message);
    return escapeHtml(String(message)).replace(/\n/g, '<br>');
}

function showConfirmWithOptions(message, options, allowHtml = false) {
    const uuid = Date.now().toString(36) + Math.random().toString(36).slice(2);
    const btns = options.map((o, i) => {
        const callbackId = `${uuid}_${i}`;
        modalCallbacks[callbackId] = o.action;
        return `
            <button class="btn ${o.danger ? 'btn-danger' : (o.ghost ? 'btn-ghost' : 'btn-primary')}" onclick="executeModalCallback('${callbackId}')">
                ${escapeHtml(o.label)}
            </button>
        `;
    }).join('');
    showModal(`
        <div class="confirm-msg">${formatConfirmMessage(message, allowHtml)}</div>
        <div class="modal-actions modal-actions-col">${btns}</div>
    `);
}
