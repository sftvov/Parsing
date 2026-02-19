const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ ДЛЯ НОВОГО САЙТА
const MAIN_URL = 'https://reg.huntfishexpo.ru/e-catalogue/2026/view';
const OUTPUT_FILENAME = 'huntfish-expo.csv';
const USE_ANSI_ENCODING = true;

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг...');
        console.log(`Основная страница: ${MAIN_URL}`);
        
        // Получаем главную страницу
        const mainPageResponse = await axios.get(MAIN_URL);
        const mainDom = new JSDOM(mainPageResponse.data);
        
        // Ищем переменную aUsers в JavaScript коде
        const scripts = mainDom.window.document.querySelectorAll('script');
        let usersData = [];
        
        for (const script of scripts) {
            const scriptContent = script.innerHTML;
            if (scriptContent.includes('var aUsers=')) {
                // Извлекаем данные из JavaScript переменной
                const usersMatch = scriptContent.match(/var aUsers=\[([\s\S]*?)\];/);
                if (usersMatch && usersMatch[1]) {
                    try {
                        // Парсим JSON данные
                        usersData = JSON.parse('[' + usersMatch[1] + ']');
                        console.log(`Найдено компаний: ${usersData.length}`);
                        break;
                    } catch (e) {
                        console.error('Ошибка парсинга JSON:', e.message);
                    }
                }
            }
        }
        
        if (usersData.length === 0) {
            console.log('Не удалось найти данные компаний');
            return;
        }
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую компанию
        for (let i = 0; i < usersData.length; i++) {
            const companyData = usersData[i];
            const companyName = companyData.company.trim();
            
            // Извлекаем номер выставки и идентификатор из лого
            let idExh = '';
            let ident = companyData.alias;
            
            const logoMatch = companyData.logo.match(/data-ident='(\d+)'/);
            if (logoMatch) {
                ident = logoMatch[1];
            }
            
            
            idExh = 37;
            
            // Формируем URL компании
            const companyUrl = `https://reg.huntfishexpo.ru/e-catalogue/2025/view?idExh=${idExh}&action=detail&ident=${ident}`;
            
            console.log(`Обрабатываем [${i + 1}/${usersData.length}]: ${companyName}`);
            
            try {
                // Переходим на страницу компании
                const companyResponse = await axios.get(companyUrl, { timeout: 10000 });
                const companyDom = new JSDOM(companyResponse.data);
                const companyDocument = companyDom.window.document;
                
                // Ищем блок с контактами
                const contactBlock = companyDocument.querySelector('.col-xs-6');
                let site = '';
                let email = '';
                let phone = '';
                
                if (contactBlock) {
                    // Ищем все параграфы в блоке
                    const paragraphs = contactBlock.querySelectorAll('p');
                    
                    for (const p of paragraphs) {
                        const text = p.textContent.trim();
                        const lowerText = text.toLowerCase();
                        
                        // Ищем сайт
                        if (lowerText.includes('site') || lowerText.includes('website') || lowerText.includes('web')) {
                            const siteMatch = text.match(URL_REGEX);
                            if (siteMatch && isValidWebsite(siteMatch[0], [])) {
                                site = cleanWebsite(siteMatch[0]);
                            }
                        }
                        
                        // Ищем email
                        if (lowerText.includes('mail') || lowerText.includes('email') || lowerText.includes('e-mail')) {
                            const emailMatch = text.match(EMAIL_REGEX);
                            if (emailMatch) {
                                email = emailMatch[0];
                            }
                        }
                        
                        // Ищем телефон
                        if (lowerText.includes('phone') || lowerText.includes('tel') || lowerText.includes('телефон')) {
                            const phoneMatch = text.match(PHONE_REGEX);
                            if (phoneMatch) {
                                phone = cleanPhone(phoneMatch[0]);
                            }
                        }
                    }
                    
                    // Если не нашли в отдельных параграфах, ищем во всем блоке
                    if (!site || !email || !phone) {
                        const blockText = contactBlock.textContent;
                        
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