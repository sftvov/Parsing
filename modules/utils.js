/**
 * Утилиты для парсеров
 */

/**
 * Задержка выполнения
 * @param {number} ms - время задержки в миллисекундах
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Логирование с временными метками
 * @param {string} message - сообщение для лога
 * @param {string} type - тип сообщения (info, error, success, warn)
 */
function log(message, type = 'info') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const icons = {
        info: 'ℹ️',
        error: '❌',
        success: '✅',
        warn: '⚠️'
    };
    
    const icon = icons[type] || icons.info;
    console.log(`${icon} [${timestamp}] ${message}`);
}

/**
 * Отображение прогресса
 * @param {number} current - текущий шаг
 * @param {number} total - общее количество
 * @param {string} label - метка процесса
 */
function showProgress(current, total, label = '') {
    const percentage = Math.round((current / total) * 100);
    const progressBar = '█'.repeat(Math.floor(percentage / 5)) + 
                       '░'.repeat(20 - Math.floor(percentage / 5));
    
    log(`${label} ${progressBar} ${percentage}% (${current}/${total})`, 'info');
}

/**
 * Случайная задержка (для имитации человеческого поведения)
 * @param {number} min - минимальная задержка
 * @param {number} max - максимальная задержка
 * @returns {Promise}
 */
function randomDelay(min = 1000, max = 3000) {
    return delay(min + Math.random() * (max - min));
}

/**
 * Повторная попытка выполнения функции
 * @param {Function} fn - функция для выполнения
 * @param {number} attempts - количество попыток
 * @param {number} delayMs - задержка между попытками
 * @returns {Promise}
 */
async function retry(fn, attempts = 3, delayMs = 1000) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === attempts - 1) throw error;
            log(`Попытка ${i + 1} не удалась, повтор через ${delayMs}мс...`, 'warn');
            await delay(delayMs);
        }
    }
}

module.exports = {
    delay,
    log,
    showProgress,
    randomDelay,
    retry
};