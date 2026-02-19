const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ ДЛЯ НОВОГО САЙТА
const BASE_URL = 'https://catalog.nmf-expo.ru/expositions/exposition/6166-nmf-2025.html';
const OUTPUT_FILENAME = 'nmf-expo.csv';
const USE_ANSI_ENCODING = true;
const COMPANIES_PER_PAGE = 48;

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг каталога NMF...');
        
        let allCompanies = [];
        let start = 0;
        let hasMorePages = true;
        
        // Собираем все компании со всех страниц
        while (hasMorePages) {
            const pageUrl = `${BASE_URL}?start=${start}`;
            console.log(`Обрабатываем страницу: ${pageUrl}`);
            
            const companies = await parseCompaniesPage(pageUrl);
            
            if (companies.length > 0) {
                allCompanies = allCompanies.concat(companies);
                console.log(`Найдено компаний на странице: ${companies.length}`);
                
                // Если компаний меньше, чем COMPANIES_PER_PAGE, значит это последняя страница
                if (companies.length < COMPANIES_PER_PAGE) {
                    hasMorePages = false;
                    console.log('Это последняя страница');
                } else {
                    start += COMPANIES_PER_PAGE;
                }
            } else {
                hasMorePages = false;
                console.log('Не найдено компаний на странице - завершаем');
            }
            
            // Задержка между страницами
            await delay(2000);
        }
        
        console.log(`Всего найдено компаний: ${allCompanies.length}`);
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую компанию
        for (let i = 0; i < allCompanies.length; i++) {
            const company = allCompanies[i];
            console.log(`Обрабатываем компанию [${i + 1}/${allCompanies.length}]: ${company.name}`);
            
            try {
                const companyDetails = await parseCompanyDetails(company.url);
                
                // Добавляем данные в CSV
                csvData += `"${company.url}";"${company.name}";"${companyDetails.site}";"${companyDetails.phone}";"${companyDetails.email}"\n`;
                
                console.log(`  Найдено: ${companyDetails.site || 'нет сайта'}, ${companyDetails.phone || 'нет телефона'}, ${companyDetails.email || 'нет email'}`);
                
                // Задержка между запросами
                await delay(1000);
                
            } catch (error) {
                console.error(`Ошибка при обработке ${company.url}:`, error.message);
                // Добавляем строку с ошибкой
                csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла ошибка:', error.message);
    }
}

// Парсинг страницы со списком компаний
async function parseCompaniesPage(pageUrl) {
    try {
        const response = await axios.get(pageUrl, { timeout: 10000 });
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        
        const companies = [];
        
        // Ищем все элементы компаний
        const companyElements = document.querySelectorAll('.scroll_item .row-fluid.rexc .span3');
        
        for (const element of companyElements) {
            // Ищем ссылку и название
            const linkElement = element.querySelector('a');
            const nameElement = element.querySelector('.comp_name');
            
            if (linkElement && nameElement) {
                const companyUrl = linkElement.href;
                const companyName = nameElement.textContent.trim();
                
                // Преобразуем относительную ссылку в абсолютную
                const fullUrl = companyUrl.startsWith('http') ? companyUrl : `https://catalog.nmf-expo.ru${companyUrl}`;
                
                companies.push({
                    name: companyName,
                    url: fullUrl
                });
            }
        }
        
        return companies;
        
    } catch (error) {
        console.error(`Ошибка при парсинге страницы ${pageUrl}:`, error.message);
        return [];
    }
}

// Парсинг детальной страницы компании
async function parseCompanyDetails(companyUrl) {
    try {
        const response = await axios.get(companyUrl, { timeout: 10000 });
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        
        let site = '';
        let email = '';
        let phone = '';
        
        // Парсим сайт
        const siteElement = document.querySelector('.company_site a');
        if (siteElement && siteElement.href) {
            site = cleanWebsite(siteElement.href);
        } else {
            // Альтернативный поиск сайта
            const siteDiv = document.querySelector('.company_site');
            if (siteDiv) {
                const siteMatch = siteDiv.textContent.match(URL_REGEX);
                if (siteMatch && isValidWebsite(siteMatch[0], [])) {
                    site = cleanWebsite(siteMatch[0]);
                }
            }
        }
        
        // Парсим email
        const emailElement = document.querySelector('.company_email a[href^="mailto:"]');
        if (emailElement) {
            email = emailElement.href.replace('mailto:', '');
        } else {
            // Альтернативный поиск email
            const emailDiv = document.querySelector('.company_email');
            if (emailDiv) {
                const emailMatch = emailDiv.textContent.match(EMAIL_REGEX);
                if (emailMatch) {
                    email = emailMatch[0];
                }
            }
        }
        
        // Парсим телефон
        const phoneDiv = document.querySelector('.company_phone');
        if (phoneDiv) {
            const phoneMatch = phoneDiv.textContent.match(PHONE_REGEX);
            if (phoneMatch) {
                phone = cleanPhone(phoneMatch[0]);
            }
        }
        
        return {
            site: site,
            email: email,
            phone: phone
        };
        
    } catch (error) {
        console.error(`Ошибка при парсинке компании ${companyUrl}:`, error.message);
        return {
            site: '',
            email: '',
            phone: ''
        };
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