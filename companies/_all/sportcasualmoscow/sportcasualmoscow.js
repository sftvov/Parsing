const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ
const FEED_URL = 'https://feeds.tildaapi.com/api/getfeed/?feeduid=546202220832&recid=199167648&c=1768904609139&size=1000&slice=1&sort%5Bdate%5D=asc&filters%5Bdate%5D=&getparts=true';
const OUTPUT_FILENAME = 'sportcasual-companies.csv';
const USE_ANSI_ENCODING = true;

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг компаний Sport Casual Moscow...');
        
        // 1. Получаем список компаний из JSON API
        const companies = await getCompaniesList();
        console.log(`Всего найдено компаний: ${companies.length}`);
        
        if (companies.length === 0) {
            console.log('Не найдено ни одной компании.');
            return;
        }
        
        // 2. Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // 3. Обрабатываем каждую компанию
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(`\nОбрабатываем компанию [${i + 1}/${companies.length}]: ${company.name}`);
            console.log(`Ссылка: ${company.url}`);
            
            try {
                const companyDetails = await parseCompanyDetails(company.url);
                
                // Добавляем данные в CSV
                csvData += `"${company.url}";"${company.name}";"${companyDetails.site}";"${companyDetails.phone}";"${companyDetails.email}"\n`;
                
                console.log(`✓ Найдено: Сайт: ${companyDetails.site || 'нет'}, Телефон: ${companyDetails.phone || 'нет'}, Email: ${companyDetails.email || 'нет'}`);
                
                // Задержка между запросами
                await delay(1500);
                
            } catch (error) {
                console.error(`✗ Ошибка при обработке: ${error.message}`);
                // Добавляем строку с ошибкой
                csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
        }
        
        // 4. Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`\n✓ Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла общая ошибка:', error.message);
    }
}

// Получение списка компаний из JSON API
async function getCompaniesList() {
    try {
        console.log('Загружаем список компаний из API...');
        
        const response = await axios.get(FEED_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            }
        });
        
        if (!response.data || !response.data.posts || !Array.isArray(response.data.posts)) {
            throw new Error('Некорректный формат ответа API');
        }
        
        const companies = [];
        const seenUrls = new Set();
        
        for (const post of response.data.posts) {
            try {
                if (post.directlink && post.title) {
                    const companyUrl = post.directlink;
                    
                    if (!seenUrls.has(companyUrl)) {
                        seenUrls.add(companyUrl);
                        
                        companies.push({
                            name: cleanText(post.title),
                            url: companyUrl
                        });
                        
                        console.log(`  - ${post.title} -> ${companyUrl}`);
                    }
                }
            } catch (error) {
                console.error('Ошибка при обработке поста:', error.message);
            }
        }
        
        return companies;
        
    } catch (error) {
        console.error('Ошибка при получении списка компаний:', error.message);
        throw error;
    }
}

// Парсинг детальной страницы компании
async function parseCompanyDetails(companyUrl) {
    try {
        const response = await axios.get(companyUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });
        
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        
        // Ищем блок .t578__text
        const textBlock = document.querySelector('.t578__text');
        
        if (!textBlock) {
            console.log(`  Блок .t578__text не найден`);
            return { site: '', phone: '', email: '' };
        }
        
        const blockText = textBlock.textContent;
        console.log(`  Найден блок .t578__text, длина текста: ${blockText.length} символов`);
        
        let site = '';
        let email = '';
        let phone = '';
        
        // СПОСОБ 1: Поиск по строкам
        const lines = blockText.split('\n').map(line => line.trim()).filter(line => line);
        
        for (const line of lines) {
            // Ищем сайт
            if (!site && (line.includes('Сайт:') || line.includes('Сайт ') || 
                         line.includes('сайт:') || line.includes('www.') || 
                         line.includes('http://') || line.includes('https://'))) {
                const urlMatch = line.match(URL_REGEX);
                if (urlMatch) {
                    for (const url of urlMatch) {
                        if (isValidWebsite(url)) {
                            site = cleanWebsite(url);
                            break;
                        }
                    }
                }
            }
            
            // Ищем email
            if (!email && (line.includes('Email:') || line.includes('E-mail:') || 
                          line.includes('email:') || line.includes('@'))) {
                const emailMatch = line.match(EMAIL_REGEX);
                if (emailMatch) {
                    email = emailMatch[0];
                }
            }
            
            // Ищем телефон
            if (!phone && (line.includes('Телефон:') || line.includes('Тел:') || 
                          line.includes('тел:') || line.includes('+7') || 
                          line.includes('+375') || line.includes('+90'))) {
                const phoneMatch = line.match(PHONE_REGEX);
                if (phoneMatch) {
                    phone = cleanPhone(phoneMatch[0]);
                }
            }
        }
        
        // СПОСОБ 2: Если не нашли, ищем во всем тексте блока
        if (!site) {
            const urlMatches = blockText.match(URL_REGEX);
            if (urlMatches) {
                for (const url of urlMatches) {
                    if (isValidWebsite(url)) {
                        site = cleanWebsite(url);
                        break;
                    }
                }
            }
        }
        
        if (!email) {
            const emailMatches = blockText.match(EMAIL_REGEX);
            if (emailMatches && emailMatches.length > 0) {
                email = emailMatches[0];
            }
        }
        
        if (!phone) {
            const phoneMatches = blockText.match(PHONE_REGEX);
            if (phoneMatches && phoneMatches.length > 0) {
                phone = cleanPhone(phoneMatches[0]);
            }
        }
        
        // СПОСОБ 3: Ищем в ссылках внутри блока
        if (!site) {
            const links = textBlock.querySelectorAll('a[href]');
            for (const link of links) {
                const href = link.getAttribute('href');
                if (href && isValidWebsite(href)) {
                    site = cleanWebsite(href);
                    break;
                }
            }
        }
        
        if (!email) {
            const mailtoLinks = textBlock.querySelectorAll('a[href^="mailto:"]');
            if (mailtoLinks.length > 0) {
                email = mailtoLinks[0].getAttribute('href').replace('mailto:', '');
            }
        }
        
        console.log(`  Результат поиска в .t578__text: Сайт="${site || 'нет'}", Телефон="${phone || 'нет'}", Email="${email || 'нет'}"`);
        
        return {
            site: site,
            email: email,
            phone: phone
        };
        
    } catch (error) {
        console.error(`Ошибка при парсинге компании ${companyUrl}:`, error.message);
        throw error;
    }
}

// Функция для очистки текста
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
}

// Функция для очистки сайта
function cleanWebsite(site) {
    if (!site) return '';
    site = site.trim();
    site = site.replace(/^[^\w]*|[^\w]*$/g, '');
    site = site.split('?')[0].split('#')[0];
    // Убираем "www." если есть и добавляем https://
    if (site.startsWith('www.')) {
        site = 'https://' + site;
    } else if (!site.startsWith('http')) {
        site = 'https://' + site;
    }
    return site;
}

// Валидация сайта
function isValidWebsite(site) {
    if (!site) return false;
    
    const lowerSite = site.toLowerCase();
    
    if (lowerSite.includes('mailto:') || 
        lowerSite.includes('tel:') ||
        lowerSite.includes('javascript:') ||
        lowerSite.includes('#') ||
        site.length <= 4 || 
        !site.includes('.') ||
        lowerSite.includes('sportcasualmoscow.ru') ||
        lowerSite.includes('tildacdn.com') ||
        lowerSite.includes('tilda.ws') ||
        lowerSite.includes('static.tildacdn.com') ||
        lowerSite.includes('yandex.ru') ||
        lowerSite.includes('google.com') ||
        lowerSite.includes('vk.com') ||
        lowerSite.includes('facebook.com') ||
        lowerSite.includes('instagram.com')) {
        return false;
    }
    
    return true;
}

// Очистка телефона
function cleanPhone(phone) {
    if (!phone) return '';
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