const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ
const MAIN_URL = 'https://textile-salon.ru/fabriki/';
const OUTPUT_FILENAME = 'textile-salon.csv';
const USE_ANSI_ENCODING = true;

// УЛУЧШЕННЫЕ РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг...');
        console.log(`Основная страница: ${MAIN_URL}`);
        
        // Получаем главную страницу со ссылками
        const mainPageResponse = await axios.get(MAIN_URL);
        const mainDom = new JSDOM(mainPageResponse.data);
        
        // Находим все ссылки на компании по классу [data-row_id] a
        const companyLinks = mainDom.window.document.querySelectorAll('[data-row_id] a');
        console.log(`Найдено ссылок: ${companyLinks.length}`);
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую ссылку
        for (let i = 0; i < companyLinks.length; i++) {
            const linkElement = companyLinks[i];
            const companyUrl = linkElement.href;
            const companyName = linkElement.textContent.trim();
            
            console.log(`Обрабатываем [${i + 1}/${companyLinks.length}]: ${companyName}`);
            
            try {
                // Переходим на страницу компании
                const companyResponse = await axios.get(companyUrl, { timeout: 10000 });
                const companyDom = new JSDOM(companyResponse.data);
                const companyDocument = companyDom.window.document;
                
                // Ищем блок .et_pb_text_inner с текстом "Контакты" в первом параграфе
                const contactBlocks = companyDocument.querySelectorAll('.et_pb_module:not(.et_pb_text_0_tb_footer) .et_pb_text_inner');
                let targetBlock = null;
                
                for (const block of contactBlocks) {
                    const firstParagraph = block.querySelector('p');
                    if (firstParagraph && firstParagraph.textContent.includes('КОНТАКТЫ')) {
                        targetBlock = block;
                        break;
                    }
                }
                
                let sites = [];
                let emails = [];
                let phones = [];
                
                // Если нашли целевой блок, парсим его
                if (targetBlock) {
                    const blockHtml = targetBlock.innerHTML;
                    sites = findWebsites(blockHtml);
                    emails = findEmails(blockHtml);
                    phones = findPhones(blockHtml);
                }
                
                // Убираем дубликаты и фильтруем результаты
                sites = [...new Set(sites)].filter(site => isValidWebsite(site, emails));
                emails = [...new Set(emails)];
                phones = [...new Set(phones)].map(phone => cleanPhone(phone));
                
                // ДОПОЛНИТЕЛЬНАЯ ОЧИСТКА САЙТОВ - убираем текст перед http://
                sites = sites.map(site => {
                    // Если сайт содержит текст перед http://, извлекаем только URL
                    if (site.includes('http://') || site.includes('https://')) {
                        const urlMatch = site.match(/(https?:\/\/[^\s]+)/);
                        return urlMatch ? urlMatch[1] : site;
                    }
                    return site;
                }).filter(site => site);
                
                // Если ничего не нашли - оставляем пустые значения
                if (sites.length === 0) sites = [''];
                if (emails.length === 0) emails = [''];
                if (phones.length === 0) phones = [''];
                
                // Добавляем данные в CSV
                csvData += `"${companyUrl}";"${companyName}";"${sites.join(', ')}";"${phones.join(', ')}";"${emails.join(', ')}"\n`;
                
                // Выводим отладочную информацию
                console.log(`  Найдено: ${sites[0] ? sites.join(', ') : 'нет сайтов'}, ${phones[0] ? phones.join(', ') : 'нет телефонов'}, ${emails[0] ? emails.join(', ') : 'нет email'}`);
                
                // Небольшая задержка между запросами
                await delay(1000);
                
            } catch (error) {
                console.error(`Ошибка при обработке ${companyUrl}:`, error.message);
                // Добавляем строку с ошибкой
                csvData += `"${companyUrl}";"${companyName}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла ошибка:', error.message);
    }
}

// Функции для поиска данных
function findEmails(html) {
    const emails = html.match(EMAIL_REGEX) || [];
    return emails;
}

function findPhones(html) {
    const phones = html.match(PHONE_REGEX) || [];
    return phones;
}

function findWebsites(html) {
    const sites = html.match(URL_REGEX) || [];
    return sites;
}

// Валидация сайтов
function isValidWebsite(site, foundEmails) {
    // Проверяем базовые условия
    if (site.includes('mailto:') || 
        site.includes('tel:') ||
        site.includes('#') ||
        site.includes('javascript:') ||
        site.length <= 4 ||
        !site.includes('.')) {
        return false;
    }
    
    // Исключаем слишком длинные "сайты" (вероятно, это текст с URL внутри)
    if (site.length > 50) {
        return false;
    }
    
    // Проверяем, не является ли сайт частью email
    for (const email of foundEmails) {
        if (email.includes('@') && site === email.split('@')[1]) {
            return false; // Это домен из email, не считать сайтом
        }
    }
    
    // Исключаем популярные почтовые домены
    const mailDomains = [
        'mail.ru', 'gmail.com', 'yandex.ru', 'yandex.com',
        'yahoo.com', 'hotmail.com', 'outlook.com', 'rambler.ru',
        'bk.ru', 'list.ru', 'inbox.ru', 'icloud.com'
    ];
    
    if (mailDomains.some(domain => site.includes(domain))) {
        return false;
    }
    
    return true;
}

// Очистка телефона от лишних символов (сохраняем слэши)
function cleanPhone(phone) {
    // Убираем только лишние пробелы, но сохраняем скобки, дефисы и слэши
    return phone.replace(/\s+/g, ' ').trim();
}

// Вспомогательные функции
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToFile(data, filename) {
    if (USE_ANSI_ENCODING) {
        const iconv = require('iconv-lite');
        const buffer = iconv.encode(data, 'win1251');
        fs.writeFileSync(filename, buffer);
    } else {
        fs.writeFileSync(filename, data, 'utf8');
    }
}

// Запускаем парсинг
parseCompanies();