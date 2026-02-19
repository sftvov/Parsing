const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const iconv = require('iconv-lite');

// КОНФИГУРАЦИЯ ПАРСЕРА
const CONFIG = {
  // === ОБЯЗАТЕЛЬНЫЕ ПАРАМЕТРЫ ВЫСТАВКИ ===
  BASE_URL: 'https://cpm-digital.ru/expositions/exposition/155-cpm-2026-spring.html',
  OUTPUT_FILENAME: 'CPM2026.csv',
  
  // === НАСТРОЙКИ ПАРСИНГА (ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ) ===
  LIST_SELECTOR: '#scroll_list .scroll_item a',
  NAME_SOURCE: 'title',
  CONTACTS_BLOCK: '#tab_contacts_flat',
  STRICT_CONTACTS_MODE: true,
  URL_FILTER: ['/company/'],
  
  // Базовые домены для исключения (добавляются к специфичным)
  EXCLUDED_DOMAINS: [
    'catalog.',
    'mailto:', 'tel:', 'javascript:',
    'facebook.com', 'vk.com', 'instagram.com',
    'youtube.com', 't.me'
  ],
  
  // === ТЕХНИЧЕСКИЕ НАСТРОЙКИ ===
  COMPANIES_PER_PAGE: 48,
  DELAY_BETWEEN_PAGES: 1500,
  DELAY_BETWEEN_COMPANIES: 1000,
  MAX_PAGES: 20
};


const TEXTILE_SALON2026 = {
  BASE_URL: 'https://catalog.textile-salon.ru/expositions/exposition/6710.html',
  OUTPUT_FILENAME: 'TEXTILE-SALON2026.csv',
};

Object.assign(CONFIG, TEXTILE_SALON2026);

const CLIMATEXPO2026 = {
  BASE_URL: 'https://catalog.climatexpo.ru/expositions/exposition/6614',
  OUTPUT_FILENAME: 'CLIMATEXPO2026.csv',
};
const CPM2026 = {
  // === ОБЯЗАТЕЛЬНЫЕ ПАРАМЕТРЫ ВЫСТАВКИ ===
  BASE_URL: 'https://cpm-digital.ru/expositions/exposition/155-cpm-2026-spring.html',
  OUTPUT_FILENAME: 'CPM2026.csv',
};
const SKREPKA_CONFIG = {
    BASE_URL: 'https://forvisitors.skrepkaexpo.ru/expositions/exposition/6164-skrepka-expo-2026.html',
    OUTPUT_FILENAME: 'skrepkaexpo.csv',
    // Добавляем специфичные домены к базовым
    EXCLUDED_DOMAINS: [
        ...CONFIG.EXCLUDED_DOMAINS, // Базовые домены
        'forvisitors.skrepkaexpo.ru',
        'skrepkaexpo.ru'
    ]
};
const UPAK_CONFIG = {
    BASE_URL: 'https://upakexpo-online.ru/expositions/exposition/137-upakexpo-2026',
    OUTPUT_FILENAME: 'upakexpo.csv',
    STRICT_CONTACTS_MODE: false,  // Только это отличается!
    URL_FILTER: ['/company/', 'view=company'],  // Добавили фильтр
    EXCLUDED_DOMAINS: [
        ...CONFIG.EXCLUDED_DOMAINS, // Базовые домены
        'upakexpo-online.ru'
    ]
};

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

// Главная функция
async function parseExhibition() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 УНИВЕРСАЛЬНЫЙ ПАРСЕР ВЫСТАВОК');
        console.log('='.repeat(60));
        console.log(`🌐 Выставка: ${getDomain(CONFIG.BASE_URL)}`);
        console.log(`📁 Файл: ${CONFIG.OUTPUT_FILENAME}`);
        console.log(`🔍 Режим поиска: ${CONFIG.STRICT_CONTACTS_MODE ? 'СТРОГИЙ (только в блоке)' : 'РЕЗЕРВНЫЙ (по всей странице)'}`);
        console.log(`📍 Блок контактов: ${CONFIG.CONTACTS_BLOCK || 'не указан'}`);
        console.log('='.repeat(60) + '\n');

        // Получаем список всех компаний
        const allCompanies = await getAllCompanies();
        
        if (allCompanies.length === 0) {
            console.log('❌ Компании не найдены. Проверьте настройки парсера.');
            saveEmptyCSV();
            return;
        }

        console.log(`✅ Всего найдено компаний: ${allCompanies.length}\n`);

        // Обрабатываем компании
        const csvData = await processCompanies(allCompanies);
        
        // Сохраняем результат
        saveToCSV(csvData, CONFIG.OUTPUT_FILENAME);
        console.log(`\n🎉 Парсинг завершен! Данные сохранены в: ${CONFIG.OUTPUT_FILENAME}`);

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    }
}

// Получение списка всех компаний
async function getAllCompanies() {
    const allCompanies = [];
    let start = 0;
    let pageNumber = 1;
    let hasMorePages = true;

    console.log('🔍 Собираем список компаний...');

    while (hasMorePages && pageNumber <= CONFIG.MAX_PAGES) {
        try {
            const pageUrl = start === 0 ? CONFIG.BASE_URL : `${CONFIG.BASE_URL}?start=${start}`;
            console.log(`   📄 Страница ${pageNumber}: ${pageUrl}`);

            const companies = await parseCompaniesPage(pageUrl);
            
            console.log(`   📊 Найдено: ${companies.length} компаний`);
            allCompanies.push(...companies);

            // Определяем, есть ли еще страницы
            if (companies.length < CONFIG.COMPANIES_PER_PAGE) {
                hasMorePages = false;
                console.log('   ⏹️  Это последняя страница');
            } else {
                start += CONFIG.COMPANIES_PER_PAGE;
                pageNumber++;
            }

            await delay(CONFIG.DELAY_BETWEEN_PAGES);

        } catch (error) {
            console.error(`   ❌ Ошибка страницы ${pageNumber}:`, error.message);
            hasMorePages = false;
        }
    }

    return allCompanies;
}

// Парсинг одной страницы со списком компаний
async function parseCompaniesPage(pageUrl) {
    try {
        const response = await axios.get(pageUrl, {
            timeout: 10000,
            headers: getHeaders()
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        const companies = [];

        const companyElements = document.querySelectorAll(CONFIG.LIST_SELECTOR);

        for (const element of companyElements) {
            try {
                const companyUrl = element.getAttribute('href');
                if (!companyUrl) continue;

                // Получаем название компании
                let companyName = '';
                if (CONFIG.NAME_SOURCE === 'title') {
                    companyName = element.getAttribute('title') || element.textContent.trim();
                } else {
                    companyName = element.textContent.trim();
                }

                if (!companyName) continue;

                // Формируем полный URL
                const fullUrl = getFullUrl(companyUrl);
                
                // Фильтруем ссылки
                if (!isValidCompanyUrl(fullUrl)) continue;

                companies.push({
                    name: cleanText(companyName),
                    url: fullUrl
                });

            } catch (error) {
                console.error('   Ошибка элемента:', error.message);
            }
        }

        return companies;

    } catch (error) {
        console.error(`Ошибка парсинга страницы ${pageUrl}:`, error.message);
        return [];
    }
}

// Обработка всех компаний
async function processCompanies(companies) {
    let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        console.log(`\n📄 Компания [${i + 1}/${companies.length}]: ${company.name}`);
        console.log(`🔗 ${company.url}`);

        try {
            const contacts = await parseCompanyContacts(company.url);
            
            csvData += `"${company.url}";"${company.name}";"${contacts.site}";"${contacts.phone}";"${contacts.email}"\n`;
            
            // Статистика по найденным контактам
            const found = [];
            if (contacts.site) found.push('сайт');
            if (contacts.phone) found.push('телефон');
            if (contacts.email) found.push('email');
            
            if (found.length > 0) {
                console.log(`✅ Найдено: ${found.join(', ')}`);
                successCount++;
            } else {
                console.log(`   ⚠️  Контакты не найдены`);
                successCount++;
            }

            await delay(CONFIG.DELAY_BETWEEN_COMPANIES + Math.random() * 500);

        } catch (error) {
            console.error(`   ❌ Ошибка: ${error.message}`);
            csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            errorCount++;
        }
    }

    // Вывод статистики
    console.log('\n' + '='.repeat(60));
    console.log('📊 СТАТИСТИКА ПАРСИНГА:');
    console.log('='.repeat(60));
    console.log(`✅ Успешно обработано: ${successCount}`);
    console.log(`❌ С ошибками: ${errorCount}`);
    console.log(`📊 Всего компаний: ${companies.length}`);
    console.log('='.repeat(60));

    return csvData;
}

// Парсинг контактов компании
async function parseCompanyContacts(companyUrl) {
    try {
        const response = await axios.get(companyUrl, {
            timeout: 10000,
            headers: getHeaders()
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        let site = '', phone = '', email = '';
        let searchSource = '';
        let searchText = '';

        // Ищем блок с контактами
        const contactsBlock = CONFIG.CONTACTS_BLOCK ? 
            document.querySelector(CONFIG.CONTACTS_BLOCK) : null;

        if (contactsBlock) {
            searchSource = 'блоке';
            searchText = contactsBlock.textContent;
            
            // Парсим из блока
            const parsed = parseContactsFromText(searchText);
            site = parsed.site;
            phone = parsed.phone;
            email = parsed.email;

        } else if (CONFIG.STRICT_CONTACTS_MODE) {
            // Строгий режим: блок не найден, возвращаем пустые значения
            console.log(`   ⚠️  Блок ${CONFIG.CONTACTS_BLOCK} не найден (строгий режим)`);
            return { site: '', phone: '', email: '' };
            
        } else {
            // Нестрогий режим: ищем по всей странице
            searchSource = 'странице';
            searchText = document.body.textContent;
            console.log(`   ⚠️  Блок ${CONFIG.CONTACTS_BLOCK} не найден, ищем по всей странице`);
            
            const parsed = parseContactsFromText(searchText);
            site = parsed.site;
            phone = parsed.phone;
            email = parsed.email;
        }

        return { site, phone, email };

    } catch (error) {
        console.error(`Ошибка парсинга контактов:`, error.message);
        return { site: '', phone: '', email: '' };
    }
}

// Парсинг контактов из текста
function parseContactsFromText(text) {
    let site = '', phone = '', email = '';

    // Поиск по меткам
    const siteMatch = text.match(/Сайт:?\s*([^\n<]+)/i);
    if (siteMatch) {
        const urlMatch = siteMatch[1].match(URL_REGEX);
        site = urlMatch ? cleanWebsite(urlMatch[0]) : cleanWebsite(siteMatch[1].trim());
    }

    const phoneMatch = text.match(/Телефон:?\s*([^\n<]+)/i);
    if (phoneMatch) {
        const phoneNumberMatch = phoneMatch[1].match(PHONE_REGEX);
        phone = phoneNumberMatch ? cleanPhone(phoneNumberMatch[0]) : cleanPhone(phoneMatch[1].trim());
    }

    const emailMatch = text.match(/E?-?mail:?\s*([^\n<]+)/i);
    if (emailMatch) {
        const emailFound = emailMatch[1].match(EMAIL_REGEX);
        email = emailFound ? emailFound[0] : '';
    }

    // Дополнительный поиск по регуляркам
    if (!email) {
        const allEmails = text.match(EMAIL_REGEX);
        email = (allEmails && allEmails.length > 0) ? allEmails[0] : '';
    }
    
    if (!phone) {
        const allPhones = text.match(PHONE_REGEX);
        phone = (allPhones && allPhones.length > 0) ? cleanPhone(allPhones[0]) : '';
    }
    
    if (!site) {
        const allUrls = text.match(URL_REGEX);
        if (allUrls) {
            for (const url of allUrls) {
                if (isValidWebsite(url)) {
                    site = cleanWebsite(url);
                    break;
                }
            }
        }
    }

    return { site, phone, email };
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function getHeaders() {
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
    };
}

function getFullUrl(url) {
    if (url.startsWith('http')) return url;
    
    // Определяем базовый домен из CONFIG.BASE_URL
    const baseDomain = CONFIG.BASE_URL.match(/https?:\/\/([^\/]+)/)[1];
    const baseUrl = `https://${baseDomain}`;
    
    return url.startsWith('/') ? baseUrl + url : baseUrl + '/' + url;
}

function isValidCompanyUrl(url) {
    if (!CONFIG.URL_FILTER || CONFIG.URL_FILTER.length === 0) return true;
    
    return CONFIG.URL_FILTER.some(filter => url.includes(filter));
}

function isValidWebsite(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.length <= 4 || !lowerUrl.includes('.')) return false;
    
    // Проверяем исключенные домены
    for (const domain of CONFIG.EXCLUDED_DOMAINS) {
        if (lowerUrl.includes(domain.toLowerCase())) return false;
    }
    
    // Проверяем протоколы
    if (lowerUrl.startsWith('mailto:') || 
        lowerUrl.startsWith('tel:') ||
        lowerUrl.startsWith('javascript:')) return false;
    
    return true;
}

function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
}

function cleanWebsite(url) {
    if (!url) return '';
    url = url.trim()
        .replace(/^[^\w]*|[^\w]*$/g, '')
        .split('?')[0]
        .split('#')[0];
    
    return url && !url.startsWith('http') ? 'https://' + url : url;
}

function cleanPhone(phone) {
    return phone ? phone.replace(/\s+/g, ' ').trim() : '';
}

function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return url;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToCSV(data, filename) {
    try {
        const buffer = iconv.encode(data, 'win1251');
        fs.writeFileSync(filename, buffer);
        console.log(`💾 Файл сохранен в кодировке Windows-1251`);
    } catch (error) {
        fs.writeFileSync(filename, data, 'utf8');
        console.log(`💾 Файл сохранен в кодировке UTF-8`);
    }
}

function saveEmptyCSV() {
    const header = 'Ссылка;Название;Сайт;Телефон;Email\n';
    saveToCSV(header, CONFIG.OUTPUT_FILENAME);
    console.log(`💾 Создан пустой CSV файл: ${CONFIG.OUTPUT_FILENAME}`);
}

// ===== ЗАПУСК ПАРСЕРА =====

// Способ 1: Использовать текущую конфигурацию из CONFIG
// parseExhibition();

// Способ 2: Использовать готовую конфигурацию
// Object.assign(CONFIG, SKREPKA_CONFIG); // Для СКРЕПКА ЭКСПО
// Object.assign(CONFIG, UPAK_CONFIG);    // Для UPAK EXPO
// parseExhibition();

// Способ 3: Запустить обе выставки последовательно
async function parseAllExhibitions() {
    console.log('🔄 Запускаем парсинг всех выставок...\n');
    
    // Парсим СКРЕПКА ЭКСПО
    Object.assign(CONFIG, SKREPKA_CONFIG);
    await parseExhibition();
    
    console.log('\n' + '='.repeat(60));
    console.log('🔄 Переходим к следующей выставке...');
    console.log('='.repeat(60) + '\n');
    
    // Парсим UPAK EXPO
    Object.assign(CONFIG, UPAK_CONFIG);
    await parseExhibition();
}

// Выберите способ запуска:
// 1. parseExhibition();                    - с текущим CONFIG
// 2. Object.assign(CONFIG, SKREPKA_CONFIG); parseExhibition(); - для СКРЕПКА
// 3. parseAllExhibitions();                - обе выставки подряд

// Запуск по умолчанию:
parseExhibition();