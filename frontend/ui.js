// --- UI MODULE ---
// Contains reusable UI functions like alerts and modals.

/**
 * Shows a custom, non-blocking notification to the user.
 * @param {string} message - The message to display.
 * @param {string} type - 'Success', 'Error', or 'Warning'.
 */
export function alertUser(message, type) {
    const colorMap = {
        'Success': 'bg-green-500',
        'Error': 'bg-red-500',
        'Warning': 'bg-yellow-500'
    };
    const color = colorMap[type] || 'bg-gray-500';

    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${color} text-white p-4 rounded-lg shadow-xl transition-opacity duration-300 opacity-0 z-50`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.remove('opacity-0'), 10);
    
    setTimeout(() => {
        notification.classList.add('opacity-0');
        notification.addEventListener('transitionend', () => notification.remove());
    }, 3000);
}

/**
 * Shows a custom modal dialog for confirmation (replaces window.confirm).
 * @param {string} title - The title of the modal.
 * @param {string} message - The confirmation message.
 * @returns {Promise<boolean>} True if confirmed, false if canceled.
 */
export function showCustomModal(title, message) {
    return new Promise(resolve => {
        const backdrop = document.createElement('div');
        backdrop.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50 transition-opacity duration-300 opacity-0';
        
        const modal = document.createElement('div');
        modal.className = 'bg-white p-6 rounded-lg shadow-2xl w-full max-w-sm transform scale-95 transition-transform duration-300';
        modal.innerHTML = `
            <h3 class="text-xl font-bold text-gray-800 mb-4">${title}</h3>
            <p class="text-gray-600 mb-6">${message}</p>
            <div class="flex justify-end space-x-3">
                <button id="cancel-btn" class="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-100">Cancel</button>
                <button id="confirm-btn" class="px-4 py-2 bg-deep-pink text-white rounded-lg hover:bg-dark-pink font-semibold">Confirm</button>
            </div>
        `;

        document.body.appendChild(backdrop);
        backdrop.appendChild(modal);
        setTimeout(() => {
            backdrop.classList.remove('opacity-0');
            modal.classList.remove('scale-95');
        }, 10);

        const cleanup = (result) => {
            modal.classList.add('scale-95');
            backdrop.classList.add('opacity-0');
            backdrop.addEventListener('transitionend', () => backdrop.remove());
            resolve(result);
        };

        document.getElementById('confirm-btn').onclick = () => cleanup(true);
        document.getElementById('cancel-btn').onclick = () => cleanup(false);
    });
}
