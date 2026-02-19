/**
 * Общие константы для всех парсеров
 */

// HTTP заголовки для имитации браузера
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
};

// Настройки по умолчанию для запросов
const DEFAULT_REQUEST_CONFIG = {
    timeout: 10000,
    maxRedirects: 5,
    responseType: 'text',
    responseEncoding: 'utf-8'
};

// CSV настройки
const CSV_CONFIG = {
    delimiter: ';',
    encoding: 'win1251',
    columns: ['Ссылка', 'Название', 'Сайт', 'Телефон', 'Email']
};

// Регулярные выражения
const REGEX = {
    EMAIL: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
    PHONE: /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g,
    URL: /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi
};

// Домены для исключения
const EXCLUDED_DOMAINS = [
    'upakexpo-online.ru',
    'catalog.',
    'mailto:',
    'tel:',
    'javascript:',
    'facebook.com',
    'vk.com',
    'twitter.com',
    'instagram.com',
    'linkedin.com'
];

module.exports = {
    DEFAULT_HEADERS,
    DEFAULT_REQUEST_CONFIG,
    CSV_CONFIG,
    REGEX,
    EXCLUDED_DOMAINS
};