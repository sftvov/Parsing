const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ ДЛЯ НОВОГО САЙТА
const MAIN_URL = 'https://online.gefera.ru/info/TCM25/catalog/?count=ALL';
const COMPANY_LINK_SELECTOR = '.info-card.hoverable a';
const CONTENT_SELECTOR = '.firm-detail-page';
const OUTPUT_FILENAME = 'gefera-tcm25.csv';
const USE_ANSI_ENCODING = false;

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90|\+\s?86)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг...');
        console.log(`Основная страница: ${MAIN_URL}`);
        
        // Получаем главную страницу со ссылками
        const mainPageResponse = await axios.get(MAIN_URL);
        const mainDom = new JSDOM(mainPageResponse.data);
        
        // Находим все ссылки на компании по указанному селектору
        const companyLinks = mainDom.window.document.querySelectorAll(COMPANY_LINK_SELECTOR);
        console.log(`Найдено ссылок: ${companyLinks.length}`);
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую ссылку
        for (let i = 0; i < companyLinks.length; i++) {
            const linkElement = companyLinks[i];
            const companyUrl = 'https://online.gefera.ru' + linkElement.href;
            
            // Находим название компании в том же блоке
            const cardElement = linkElement.closest('.info-card.hoverable');
            const companyNameElement = cardElement ? cardElement.querySelector('.info-card__title') : null;
            const companyName = companyNameElement ? companyNameElement.textContent.trim() : 'Неизвестно';
            
            console.log(`Обрабатываем [${i + 1}/${companyLinks.length}]: ${companyName}`);
            
            try {
                // Переходим на страницу компании
                const companyResponse = await axios.get(companyUrl, { timeout: 10000 });
                const companyDom = new JSDOM(companyResponse.data);
                const companyDocument = companyDom.window.document;
                
                // Ищем контентный блок
                const contentBlock = companyDocument.querySelector(CONTENT_SELECTOR);
                
                let site = '';
                let email = '';
                let phone = '';
                
                // Если нашли контентный блок, ищем конкретные параграфы
                if (contentBlock) {
                    const paragraphs = contentBlock.querySelectorAll('p');
                    
                    for (const p of paragraphs) {
                        const text = p.textContent.trim();
                        
                        // Ищем телефон
                        if ((text.includes('Телефон') || text.includes('Phone') || text.includes('Tel')) && !phone) {
                            const phoneMatch = text.match(PHONE_REGEX);
                            if (phoneMatch) {
                                phone = cleanPhone(phoneMatch[0]);
                            }
                        }
                        
                        // Ищем email
                        if ((text.includes('E-mail') || text.includes('Email') || text.includes('Mail')) && !email) {
                            const emailMatch = text.match(EMAIL_REGEX);
                            if (emailMatch) {
                                email = emailMatch[0];
                            }
                        }
                        
                        // Ищем сайт
                        if ((text.includes('Сайт') || text.includes('Site') || text.includes('Website') || text.includes('Веб-сайт') || text.includes('Адрес в Интернете')) && !site) {
                            const siteMatch = text.match(URL_REGEX);
                            if (siteMatch && isValidWebsite(siteMatch[0], [])) {
                                site = cleanWebsite(siteMatch[0]);
                            }
                        }
                    }
                    
                    // Если не нашли в отдельных параграфах, ищем во всем блоке
                    if (!site || !email || !phone) {
                        const blockText = contentBlock.textContent;
                        
                        if (!site) {
                            const siteMatch = blockText.match(URL_REGEX);
                            if (siteMatch && isValidWebsite(siteMatch[0], [])) {
                                site = cleanWebsite(siteMatch[0]);
                            }
                        }
                        
                        if (!email) {
                            const emailMatch = blockText.match(EMAIL_REGEX);
                            if (emailMatch) {
                                email = emailMatch[0];
                            }
                        }
                        
                        if (!phone) {
                            const phoneMatch = blockText.match(PHONE_REGEX);
                            if (phoneMatch) {
                                phone = cleanPhone(phoneMatch[0]);
                            }
                        }
                    }
                }
                
                // Добавляем данные в CSV
                csvData += `"${companyUrl}";"${companyName}";"${site}";"${phone}";"${email}"\n`;
                
                // Выводим отладочную информацию
                console.log(`  Найдено: ${site || 'нет сайта'}, ${phone || 'нет телефона'}, ${email || 'нет email'}`);
                
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

// Функция для очистки сайта
function cleanWebsite(site) {
    // Убираем лишние символы вокруг URL
    site = site.replace(/^[^\w]*|[^\w]*$/g, '');
    
    // Добавляем http:// если отсутствует
    if (site && !site.startsWith('http')) {
        site = 'http://' + site;
    }
    
    return site;
}

// Валидация сайтов
function isValidWebsite(site, foundEmails) {
    if (!site || 
        site.includes('mailto:') || 
        site.includes('tel:') ||
        site.includes('#') ||
        site.includes('javascript:') ||
        site.length <= 4 ||
        !site.includes('.')) {
        return false;
    }
    
    if (site.length > 50) {
        return false;
    }
    
    for (const email of foundEmails) {
        if (email.includes('@') && site === email.split('@')[1]) {
            return false;
        }
    }
    
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

// Очистка телефона
function cleanPhone(phone) {
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