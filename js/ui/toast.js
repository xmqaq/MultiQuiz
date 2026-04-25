// Toast 通知

function showToast(message, type = 'info') {
    let container = document.getElementById('globalToastContainer') || document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
    }
    if (container.id !== 'globalToastContainer') {
        container.id = 'globalToastContainer';
    }
    if (container.parentElement !== document.body) {
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const text = document.createElement('span');
    text.className = 'toast-message';
    text.textContent = String(message);
    toast.appendChild(text);
    container.appendChild(toast);
    setTimeout(() => { }, 10);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
