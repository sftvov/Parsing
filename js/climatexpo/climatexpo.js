const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ
const BASE_URL = 'https://catalog.climatexpo.ru/?Itemid=132&option=com_expo&view=exposition&task=viewexposition&id=6136&ajaxScroll=1&start=';
const OUTPUT_FILENAME = 'climatexpo-companies.csv';
const USE_ANSI_ENCODING = true;

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг каталога ClimateExpo...');
        
        let allCompanies = [];
        let start = 0;
        let hasMorePages = true;
        let pageCount = 0;
        
        // Собираем все компании со всех страниц
        while (hasMorePages && pageCount < 10) { // ограничим 5 страницами для теста
            const pageUrl = `${BASE_URL}${start}`;
            console.log(`\n=== Обрабатываем страницу ${pageCount + 1}: ${pageUrl} ===`);
            
            const companies = await parseCompaniesPage(pageUrl);
            
            if (companies.length > 0) {
                allCompanies = allCompanies.concat(companies);
                console.log(`✓ Найдено компаний на странице: ${companies.length}`);
                
                start += 48; // шаг пагинации
                pageCount++;
            } else {
                hasMorePages = false;
                console.log('✗ Не найдено компаний на странице - завершаем');
            }
            
            // Задержка между страницами
            await delay(2000);
        }
        
        console.log(`\n=== РЕЗУЛЬТАТ: Всего найдено компаний: ${allCompanies.length} ===`);
        
        if (allCompanies.length === 0) {
            console.log('Не найдено ни одной компании. Проверьте структуру сайта.');
            return;
        }
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую компанию
        for (let i = 0; i < allCompanies.length; i++) {
            const company = allCompanies[i];
            console.log(`\nОбрабатываем компанию [${i + 1}/${allCompanies.length}]: ${company.name}`);
            console.log(`Ссылка: ${company.url}`);
            
            try {
                const companyDetails = await parseCompanyDetails(company.url);
                
                // Добавляем данные в CSV
                csvData += `"${company.url}";"${company.name}";"${companyDetails.site}";"${companyDetails.phone}";"${companyDetails.email}"\n`;
                
                console.log(`✓ Найдено: Сайт: ${companyDetails.site || 'нет'}, Телефон: ${companyDetails.phone || 'нет'}, Email: ${companyDetails.email || 'нет'}`);
                
                // Задержка между запросами
                await delay(1500);
                
            } catch (error) {
                console.error(`✗ Ошибка при обработке:`, error.message);
                // Добавляем строку с ошибкой
                csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`\n✓ Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла общая ошибка:', error.message);
    }
}

// Парсинг страницы со списком компаний
async function parseCompaniesPage(pageUrl) {
    try {
        const response = await axios.get(pageUrl, { 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept-Encoding': 'gzip, deflate, br'
            }
        });
        
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        
        const companies = [];
        
        // Ищем компании по структуре из HTML
        const companyElements = document.querySelectorAll('.scroll_item .row-fluid.rexc .span12 a[href*="/companies/company/"]');
        
        console.log(`Найдено элементов компаний: ${companyElements.length}`);
        
        // Обрабатываем найденные компании
        for (const element of companyElements) {
            try {
                const companyUrl = element.getAttribute('href');
                const companyName = element.getAttribute('title') || 
                                   element.querySelector('.exh_name')?.textContent?.trim() ||
                                   'Неизвестное название';
                
                if (companyUrl && companyName !== 'Неизвестное название') {
                    // Преобразуем относительную ссылку в абсолютную
                    const fullUrl = companyUrl.startsWith('http') ? 
                        companyUrl : `https://catalog.climatexpo.ru${companyUrl}`;
                    
                    companies.push({
                        name: cleanText(companyName),
                        url: fullUrl
                    });
                    
                    console.log(`  - ${companyName} -> ${fullUrl}`);
                }
            } catch (error) {
                console.error('Ошибка при обработке элемента компании:', error.message);
            }
        }
        
        // Если не нашли по точному селектору, пробуем альтернативные способы
        if (companyElements.length === 0) {
            console.log('Пробуем альтернативные способы поиска...');
            
            // Способ 2: Ищем все ссылки с паттерном /companies/company/
            const allLinks = document.querySelectorAll('a[href*="/companies/company/"]');
            console.log(`Найдено ссылок с паттерном /companies/company/: ${allLinks.length}`);
            
            for (const link of allLinks) {
                try {
                    const companyUrl = link.getAttribute('href');
                    const companyName = link.getAttribute('title') || 
                                       link.textContent?.trim() ||
                                       'Неизвестное название';
                    
                    if (companyUrl && companyName !== 'Неизвестное название') {
                        const fullUrl = companyUrl.startsWith('http') ? 
                            companyUrl : `https://catalog.climatexpo.ru${companyUrl}`;
                        
                        companies.push({
                            name: cleanText(companyName),
                            url: fullUrl
                        });
                    }
                } catch (error) {
                    console.error('Ошибка при обработке альтернативной ссылки:', error.message);
                }
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
        console.log(`  Загружаем страницу компании...`);
        
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
        
        let site = '';
        let email = '';
        let phone = '';
        
        console.log(`  Анализируем структуру страницы компании...`);
        
        // Ищем блок контактов по ID (как в примере)
        const contactsBlock = document.querySelector('#tab_contacts_flat');
        
        if (contactsBlock) {
            console.log(`  Найден блок #tab_contacts_flat`);
            
            // Парсим сайт
            const siteElement = contactsBlock.querySelector('.company_site a');
            if (siteElement && siteElement.href) {
                site = cleanWebsite(siteElement.href);
                console.log(`  Найден сайт: ${site}`);
            } else {
                const siteDiv = contactsBlock.querySelector('.company_site');
                if (siteDiv) {
                    const siteMatch = siteDiv.textContent.match(URL_REGEX);
                    if (siteMatch) {
                        site = cleanWebsite(siteMatch[0]);
                        console.log(`  Найден сайт из текста: ${site}`);
                    }
                }
            }
            
            // Парсим email
            const emailElement = contactsBlock.querySelector('.company_email a[href^="mailto:"]');
            if (emailElement) {
                email = emailElement.href.replace('mailto:', '').trim();
                console.log(`  Найден email: ${email}`);
            } else {
                const emailDiv = contactsBlock.querySelector('.company_email');
                if (emailDiv) {
                    const emailMatch = emailDiv.textContent.match(EMAIL_REGEX);
                    if (emailMatch) {
                        email = emailMatch[0];
                        console.log(`  Найден email из текста: ${email}`);
                    }
                }
            }
            
            // Парсим телефон
            const phoneDiv = contactsBlock.querySelector('.company_phone');
            if (phoneDiv) {
                const phoneMatch = phoneDiv.textContent.match(PHONE_REGEX);
                if (phoneMatch) {
                    phone = cleanPhone(phoneMatch[0]);
                    console.log(`  Найден телефон: ${phone}`);
                }
            }
        } else {
            console.log(`  Блок #tab_contacts_flat не найден, ищем альтернативные способы...`);
            
            // Альтернативный поиск по всей странице
            const pageText = document.body.textContent;
            
            // Ищем сайт
            const siteMatch = pageText.match(URL_REGEX);
            if (siteMatch) {
                for (const url of siteMatch) {
                    if (isValidWebsite(url)) {
                        site = cleanWebsite(url);
                        console.log(`  Найден сайт альтернативно: ${site}`);
                        break;
                    }
                }
            }
            
            // Ищем email
            const emailMatch = pageText.match(EMAIL_REGEX);
            if (emailMatch) {
                email = emailMatch[0];
                console.log(`  Найден email альтернативно: ${email}`);
            }
            
            // Ищем телефон
            const phoneMatch = pageText.match(PHONE_REGEX);
            if (phoneMatch) {
                phone = cleanPhone(phoneMatch[0]);
                console.log(`  Найден телефон альтернативно: ${phone}`);
            }
        }
        
        return {
            site: site,
            email: email,
            phone: phone
        };
        
    } catch (error) {
        console.error(`  Ошибка при парсинге компании:`, error.message);
        return {
            site: '',
            email: '',
            phone: ''
        };
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
    site = site.replace(/^[^\w]*|[^\w]*$/g, '');
    site = site.split('?')[0].split('#')[0];
    return site;
}

// Валидация сайта
function isValidWebsite(site) {
    if (!site || site.includes('mailto:') || site.includes('tel:') ||
        site.includes('#') || site.includes('javascript:') ||
        site.length <= 4 || !site.includes('.') || 
        site.includes('climatexpo.ru') || site.includes('yandex.ru') ||
        site.includes('google.com') || site.includes('vk.com')) {
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