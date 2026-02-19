const axios = require('axios');
const https = require('https');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const iconv = require('iconv-lite');

// SSL обход
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// КОНФИГУРАЦИЯ ПАРСЕРА
const CONFIG = {
  BASE_URL: 'https://www.diveshow.ru/companies/',
  OUTPUT_FILENAME: 'MOSCOW_DIVE_SHOW2026.csv',
  
  // === ПРОСТЫЕ НАСТРОЙКИ ===
  LIST_SELECTOR: '.s_company',               // ТОЛЬКО ссылки с этим классом
  NAME_SOURCE: 'text',                       // Название из текста
  CONTACTS_BLOCK: '.company_contacts',       // Блок для контактов
  STRICT_CONTACTS_MODE: true,                // ТОЛЬКО в блоке
  
  // Домены для исключения
  EXCLUDED_DOMAINS: [
    'diveshow.ru',
    'www.diveshow.ru',
    'mailto:', 'tel:', 'javascript:',
    'facebook.com', 'vk.com', 'instagram.com',
    'youtube.com', 't.me'
  ],
  
  // === ТЕХНИЧЕСКИЕ НАСТРОЙКИ ===
  DELAY_BETWEEN_COMPANIES: 1200
};

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90|\+\s?380|\+\s?48)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseExhibition() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 ПАРСЕР: MOSCOW DIVE SHOW 2026');
        console.log('='.repeat(60));
        console.log(`🌐 URL: ${CONFIG.BASE_URL}`);
        console.log(`📁 Файл: ${CONFIG.OUTPUT_FILENAME}`);
        console.log('='.repeat(60) + '\n');

        // 1. Загружаем страницу
        console.log('🔍 Загружаем страницу со списком компаний...');
        const response = await axios.get(CONFIG.BASE_URL, {
            timeout: 15000,
            httpsAgent: httpsAgent,
            headers: getHeaders()
        });

        // 2. Ищем все компании
        console.log('🔎 Ищем компании по селектору ".s_company"...');
        const allCompanies = parseCompaniesFromPage(response.data);
        
        if (allCompanies.length === 0) {
            console.log('❌ Компании не найдены!');
            saveEmptyCSV();
            return;
        }

        console.log(`✅ Найдено компаний: ${allCompanies.length}\n`);

        // 3. Подготавливаем CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        let successCount = 0;
        let errorCount = 0;
        let foundContacts = { site: 0, phone: 0, email: 0 };

        // 4. Обрабатываем каждую компанию
        for (let i = 0; i < allCompanies.length; i++) {
            const company = allCompanies[i];
            console.log(`📄 [${i + 1}/${allCompanies.length}] ${company.name}`);

            try {
                const contacts = await parseCompanyContacts(company.url);
                
                // Добавляем в CSV
                csvData += `"${company.url}";"${company.name}";"${contacts.site}";"${contacts.phone}";"${contacts.email}"\n`;
                
                // Статистика
                const found = [];
                if (contacts.site) { 
                    found.push('сайт'); 
                    foundContacts.site++; 
                }
                if (contacts.phone) { 
                    found.push('телефон'); 
                    foundContacts.phone++; 
                }
                if (contacts.email) { 
                    found.push('email'); 
                    foundContacts.email++; 
                }
                
                if (found.length > 0) {
                    console.log(`   ✅ Найдено: ${found.join(', ')}`);
                } else {
                    console.log(`   ⚠️  Контакты не найдены`);
                }
                
                successCount++;

            } catch (error) {
                console.error(`   ❌ Ошибка: ${error.message}`);
                csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
                errorCount++;
            }

            // Задержка между запросами
            if (i < allCompanies.length - 1) {
                await delay(CONFIG.DELAY_BETWEEN_COMPANIES);
            }
        }

        // 5. Сохраняем результат
        saveToCSV(csvData, CONFIG.OUTPUT_FILENAME);
        
        // Статистика
        console.log('\n' + '='.repeat(60));
        console.log('📊 СТАТИСТИКА:');
        console.log('='.repeat(60));
        console.log(`✅ Обработано: ${successCount}`);
        console.log(`❌ Ошибок: ${errorCount}`);
        console.log(`🌐 Сайтов: ${foundContacts.site}`);
        console.log(`📞 Телефонов: ${foundContacts.phone}`);
        console.log(`✉️  Email: ${foundContacts.email}`);
        console.log(`💾 Файл: ${CONFIG.OUTPUT_FILENAME}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    }
}

// Парсинг списка компаний с одной страницы
function parseCompaniesFromPage(html) {
    const companies = [];
    
    try {
        const dom = new JSDOM(html);
        const document = dom.window.document;
        
        // Ищем ВСЕ ссылки с классом .s_company
        const companyElements = document.querySelectorAll(CONFIG.LIST_SELECTOR);
        
        console.log(`   Найдено элементов ".s_company": ${companyElements.length}`);
        
        for (const element of companyElements) {
            try {
                const href = element.getAttribute('href');
                const name = element.textContent.trim();
                
                // Проверяем, что есть и ссылка и название
                if (href && name && name.length > 0) {
                    // Преобразуем относительную ссылку в абсолютную
                    const fullUrl = href.startsWith('http') 
                        ? href 
                        : `https://www.diveshow.ru${href}`;
                    
                    companies.push({
                        name: cleanText(name),
                        url: fullUrl
                    });
                    
                    console.log(`   ✓ ${name.substring(0, 40)}... -> ${fullUrl}`);
                }
            } catch (error) {
                console.error('   Ошибка элемента:', error.message);
            }
        }
        
    } catch (error) {
        console.error('Ошибка парсинга страницы:', error.message);
    }
    
    return companies;
}

// Парсинг контактов компании
async function parseCompanyContacts(companyUrl) {
    try {
        console.log(`   🔗 Загружаем: ${companyUrl}`);
        
        const response = await axios.get(companyUrl, {
            timeout: 15000,
            httpsAgent: httpsAgent,
            headers: getHeaders()
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        let site = '', phone = '', email = '';

        // Ищем блок .company_contacts
        const contactsBlock = document.querySelector(CONFIG.CONTACTS_BLOCK);
        
        if (contactsBlock) {
            console.log(`   ✓ Блок ".company_contacts" найден`);
            const contacts = parseContactsFromBlock(contactsBlock);
            site = contacts.site;
            phone = contacts.phone;
            email = contacts.email;
        } else {
            console.log(`   ⚠️  Блок ".company_contacts" не найден`);
        }

        return { site, phone, email };

    } catch (error) {
        console.error(`   ❌ Ошибка загрузки: ${error.message}`);
        return { site: '', phone: '', email: '' };
    }
}
// Парсинг контактов из блока
function parseContactsFromBlock(block) {
    let site = '', phone = '', email = '';
    const text = block.textContent;
    
    // Ищем сайт (разные варианты написания)
    const sitePatterns = [
        /Сайт:?\s*([^\n<]+)/i,
        /Веб-сайт:?\s*([^\n<]+)/i,
        /Website:?\s*([^\n<]+)/i
    ];
    
    // Ищем телефон (разные варианты)
    const phonePatterns = [
        /Телефон:?\s*([^\n<]+)/i,
        /Тел\.:?\s*([^\n<]+)/i,
        /Phone:?\s*([^\n<]+)/i
    ];
    
    // Ищем email (ВСЕ возможные варианты написания)
    const emailPatterns = [
        /Email:?\s*([^\n<]+)/i,      // Email:
        /E-mail:?\s*([^\n<]+)/i,     // E-mail:
        /e-Mail:?\s*([^\n<]+)/i,     // e-Mail: (именно ваш случай!)
        /E-Mail:?\s*([^\n<]+)/i,     // E-Mail:
        /Эл\. почта:?\s*([^\n<]+)/i, // Эл. почта:
        /Почта:?\s*([^\n<]+)/i       // Почта:
    ];
    
    // Парсим сайт
    for (const pattern of sitePatterns) {
        const match = text.match(pattern);
        if (match) {
            const urlMatch = match[1].match(URL_REGEX);
            if (urlMatch && isValidWebsite(urlMatch[0])) {
                site = cleanWebsite(urlMatch[0]);
                break;
            }
        }
    }
    
    // Парсим телефон
    for (const pattern of phonePatterns) {
        const match = text.match(pattern);
        if (match) {
            const phoneMatch = match[1].match(PHONE_REGEX);
            if (phoneMatch) {
                phone = cleanPhone(phoneMatch[0]);
                break;
            }
        }
    }
    
    // Парсим email
    for (const pattern of emailPatterns) {
        const match = text.match(pattern);
        if (match) {
            // Ищем email в тексте
            const emailMatch = match[1].match(EMAIL_REGEX);
            if (emailMatch) {
                email = emailMatch[0];
                break;
            }
        }
    }
    
    // Если не нашли по меткам, ищем ВСЕ email в блоке
    if (!email) {
        const allEmails = text.match(EMAIL_REGEX);
        if (allEmails && allEmails.length > 0) {
            email = allEmails[0];
        }
    }
    
    // Также ищем в mailto ссылках
    if (!email && block.innerHTML) {
        const mailtoMatch = block.innerHTML.match(/mailto:([^"'\s]+)/i);
        if (mailtoMatch) {
            email = mailtoMatch[1];
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

function isValidWebsite(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.length <= 4 || !lowerUrl.includes('.')) return false;
    
    // Проверяем исключенные домены
    for (const domain of CONFIG.EXCLUDED_DOMAINS) {
        if (lowerUrl.includes(domain.toLowerCase())) return false;
    }
    
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
    
    if (!url) return '';
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.startsWith('www.')) {
            return 'https://' + url;
        } else {
            return 'https://www.' + url;
        }
    }
    
    return url;
}

function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\s+/g, ' ').trim();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToCSV(data, filename) {
    try {
        const buffer = iconv.encode(data, 'win1251');
        fs.writeFileSync(filename, buffer);
        console.log(`💾 Файл сохранен в Windows-1251`);
    } catch (error) {
        fs.writeFileSync(filename, data, 'utf8');
        console.log(`💾 Файл сохранен в UTF-8`);
    }
}

function saveEmptyCSV() {
    const header = 'Ссылка;Название;Сайт;Телефон;Email\n';
    saveToCSV(header, CONFIG.OUTPUT_FILENAME);
    console.log(`💾 Создан пустой CSV файл`);
}

// Запуск парсера
parseExhibition();