/**
 * Очистка и нормализация данных
 */

/**
 * Очистка текста от лишних пробелов и кавычек
 * @param {string} text - исходный текст
 * @returns {string}
 */
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
}

/**
 * Извлечение email из текста
 * @param {string} text - текст для поиска
 * @returns {Array} - массив найденных email
 */
function extractEmails(text) {
    if (!text) return [];
    const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const emails = text.match(EMAIL_REGEX) || [];
    return [...new Set(emails)]; // Удаляем дубликаты
}

/**
 * Извлечение телефонов из текста
 * @param {string} text - текст для поиска
 * @returns {Array} - массив найденных телефонов
 */
function extractPhones(text) {
    if (!text) return [];
    const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
    const phones = text.match(PHONE_REGEX) || [];
    return [...new Set(phones.map(cleanPhone))]; // Удаляем дубликаты и очищаем
}

/**
 * Очистка номера телефона
 * @param {string} phone - номер телефона
 * @returns {string}
 */
function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\s+/g, ' ').trim();
}

/**
 * Извлечение URL из текста
 * @param {string} text - текст для поиска
 * @returns {Array} - массив найденных URL
 */
function extractWebsites(text) {
    if (!text) return [];
    const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;
    const urls = text.match(URL_REGEX) || [];
    return [...new Set(urls.filter(isValidWebsite).map(cleanWebsite))];
}

/**
 * Проверка валидности URL
 * @param {string} url - URL для проверки
 * @returns {boolean}
 */
function isValidWebsite(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    const excluded = ['upakexpo-online.ru', 'catalog.', 'mailto:', 'tel:', 'javascript:', 'facebook.com', 'vk.com'];
    return !(lowerUrl.length <= 4 || !lowerUrl.includes('.') || excluded.some(domain => lowerUrl.includes(domain)));
}

/**
 * Очистка и нормализация URL
 * @param {string} url - URL для очистки
 * @returns {string}
 */
function cleanWebsite(url) {
    if (!url) return '';
    url = url.trim().replace(/^[^\w]*|[^\w]*$/g, '').split('?')[0].split('#')[0];
    return url && !url.startsWith('http') ? 'https://' + url : url;
}

/**
 * Нормализация URL относительно базового
 * @param {string} url - относительный или абсолютный URL
 * @param {string} baseUrl - базовый URL
 * @returns {string}
 */
function normalizeUrl(url, baseUrl) {
    if (!url) return '';
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
    }
    
    if (url.startsWith('/')) {
        const base = new URL(baseUrl);
        return `${base.protocol}//${base.host}${url}`;
    }
    
    return `${baseUrl}/${url}`;
}

/**
 * Очистка названия компании
 * @param {string} name - название компании
 * @returns {string}
 */
function cleanCompanyName(name) {
    if (!name) return '';
    return name
        .replace(/ООО\s*|ЗАО\s*|АО\s*|ИП\s*/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = {
    cleanText,
    extractEmails,
    extractPhones,
    extractWebsites,
    cleanPhone,
    cleanWebsite,
    normalizeUrl,
    cleanCompanyName,
    isValidWebsite
};