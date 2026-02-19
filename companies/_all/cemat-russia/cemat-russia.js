const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ ДЛЯ НОВОГО САЙТА
const MAIN_URL = 'https://www.cemat-russia.ru/exhibition/catalogue/?letter=all';
const OUTPUT_FILENAME = 'cemat-russia.csv';
const USE_ANSI_ENCODING = true;

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /[\+\d\s\-\(\)\.]{6,20}/g; // Более широкое регулярное выражение для телефонов
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг...');
        console.log(`Основная страница: ${MAIN_URL}`);
        
        // Получаем главную страницу
        const mainPageResponse = await axios.get(MAIN_URL);
        const mainDom = new JSDOM(mainPageResponse.data);
        
        // Находим все модальные окна с компаниями
        const modalContents = mainDom.window.document.querySelectorAll('.modal__content');
        console.log(`Найдено компаний: ${modalContents.length}`);
        
        // Подготовка данных для CSV
        let csvData = 'Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую компанию
        for (let i = 0; i < modalContents.length; i++) {
            const modalContent = modalContents[i];
            
            // Извлекаем название компании
            const nameElement = modalContent.querySelector('.catalogue-name');
            let companyName = nameElement ? nameElement.textContent.trim() : 'Неизвестно';
            
            // Убираем два и больше пробелов подряд, заменяя на одинарный пробел
            companyName = cleanSpaces(companyName);
            
            console.log(`Обрабатываем [${i + 1}/${modalContents.length}]: ${companyName}`);
            
            let site = '';
            let email = '';
            let phone = '';
            
            // Ищем блок с адресом и контактами
            const addressBlock = modalContent.querySelector('.catalogue-address');
            
            if (addressBlock) {
                const addressHtml = addressBlock.innerHTML;
                
                // Разбиваем на строки по <br> тегам
                const lines = addressHtml.split(/<br\s*\/?>/i);
                
                for (const line of lines) {
                    const text = new JSDOM(line).window.document.body.textContent.trim();
                    
                    // Ищем телефон в строке с текстом "Телефон"
                    if (text.toLowerCase().includes('телефон') && !phone) {
                        // Убираем слово "Телефон:" и подобные, затем ищем номер
                        const cleanText = text.replace(/телефон[\s:]*/gi, '').trim();
                        const phoneMatch = cleanText.match(PHONE_REGEX);
                        if (phoneMatch) {
                            phone = cleanPhone(phoneMatch[0]);
                        }
                    }
                    
                    // Ищем email
                    if (text.toLowerCase().includes('e-mail') && !email) {
                        const emailMatch = text.match(EMAIL_REGEX);
                        if (emailMatch) {
                            email = emailMatch[0];
                        }
                    }
                    
                    // Ищем сайт в строке с текстом "Веб-сайт"
                    if ((text.toLowerCase().includes('веб-сайт') || text.toLowerCase().includes('website')) && !site) {
                        const siteMatch = text.match(URL_REGEX);
                        if (siteMatch && isValidWebsite(siteMatch[0], [])) {
                            site = cleanWebsite(siteMatch[0]);
                        }
                    }
                }
                
                // Резервный поиск: если не нашли в отдельных строках, ищем во всем блоке
                const addressText = addressBlock.textContent;
                
                if (!site) {
                    const siteMatch = addressText.match(URL_REGEX);
                    if (siteMatch && isValidWebsite(siteMatch[0], [])) {
                        site = cleanWebsite(siteMatch[0]);
                    }
                }
                
                if (!email) {
                    const emailMatch = addressText.match(EMAIL_REGEX);
                    if (emailMatch) {
                        email = emailMatch[0];
                    }
                }
                
                if (!phone) {
                    const phoneMatch = addressText.match(PHONE_REGEX);
                    if (phoneMatch) {
                        phone = cleanPhone(phoneMatch[0]);
                    }
                }
            }
            
            // Добавляем данные в CSV
            csvData += `"${companyName}";"${site}";"${phone}";"${email}"\n`;
            
            // Выводим отладочную информацию
            console.log(`  Найдено: ${site || 'нет сайта'}, ${phone || 'нет телефона'}, ${email || 'нет email'}`);
            
            // Небольшая задержка между обработкой
            await delay(500);
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла ошибка:', error.message);
    }
}

// Функция для очистки лишних пробелов
function cleanSpaces(text) {
    return text.replace(/\s+/g, ' ').trim();
}

// Функция для очистки сайта
function cleanWebsite(site) {
    if (!site) return '';
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
    if (!site || site.includes('mailto:') || site.includes('tel:') ||
        site.includes('#') || site.includes('javascript:') ||
        site.length <= 4 || !site.includes('.')) {
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