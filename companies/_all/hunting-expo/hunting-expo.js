const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const iconv = require('iconv-lite');

// КОНФИГУРАЦИЯ ПАРСЕРА
const CONFIG = {
    BASE_URL: 'https://hunting-expo.ru/members/index.php',
    OUTPUT_FILENAME: 'hunting-expo-companies.csv',
    DELAY_BETWEEN_COMPANIES: 1200, // мс
    TIMEOUT: 15000
};

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90|\+\s?380|\+\s?48)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseExhibition() {
    try {
        console.log('='.repeat(70));
        console.log('🚀 ПАРСЕР: Охота и рыболовство на Руси');
        console.log('='.repeat(70));
        console.log(`🌐 URL: ${CONFIG.BASE_URL}`);
        console.log(`📁 Файл: ${CONFIG.OUTPUT_FILENAME}`);
        console.log('='.repeat(70) + '\n');

        // 1. Получаем список компаний
        console.log('🔍 Собираем список компаний...');
        const allCompanies = await getCompaniesList();
        
        if (allCompanies.length === 0) {
            console.log('❌ Компании не найдены!');
            saveEmptyCSV();
            return;
        }

        console.log(`✅ Найдено компаний: ${allCompanies.length}\n`);
        
        // Выводим первые 5 для проверки
        console.log('📋 Первые 5 компаний:');
        allCompanies.slice(0, 5).forEach((company, i) => {
            console.log(`   ${i + 1}. ${company.name} -> ${company.url}`);
        });
        console.log('');

        // 2. Обрабатываем компании
        const result = await processCompanies(allCompanies);
        
        // 3. Сохраняем результат
        saveToCSV(result.csvData, CONFIG.OUTPUT_FILENAME);
        
        // 4. Выводим статистику
        printStatistics(result, allCompanies.length);

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    }
}

// Получение списка компаний
async function getCompaniesList() {
    try {
        const response = await axios.get(CONFIG.BASE_URL, getRequestOptions());
        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        
        const companies = [];
        
        // Ищем все элементы .members__text
        const companyElements = document.querySelectorAll('.members__text');
        console.log(`   Найдено элементов .members__text: ${companyElements.length}`);
        
        for (const element of companyElements) {
            try {
                // Получаем onclick атрибут
                const onclickAttr = element.getAttribute('onclick');
                if (!onclickAttr) continue;
                
                // Извлекаем URL из window.open
                const urlMatch = onclickAttr.match(/window\.open\('([^']+)'/);
                if (!urlMatch || !urlMatch[1]) continue;
                
                // Получаем название компании из текста элемента
                const companyName = element.textContent.trim();
                if (!companyName) continue;
                
                // Формируем полный URL
                const relativeUrl = urlMatch[1];
                const fullUrl = relativeUrl.startsWith('http') 
                    ? relativeUrl 
                    : `https://hunting-expo.ru${relativeUrl.startsWith('/') ? relativeUrl : '/' + relativeUrl}`;
                
                companies.push({
                    name: cleanText(companyName),
                    url: fullUrl,
                    id: extractCompanyId(relativeUrl)
                });
                
                console.log(`   ✓ ${companyName}`);
                
            } catch (error) {
                console.error('   Ошибка элемента:', error.message);
            }
        }
        
        return companies;
        
    } catch (error) {
        console.error('Ошибка получения списка компаний:', error.message);
        return [];
    }
}

// Обработка всех компаний
async function processCompanies(companies) {
    let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
    let successCount = 0;
    let errorCount = 0;
    let foundContacts = { site: 0, phone: 0, email: 0 };

    console.log(`🔧 Начинаем обработку ${companies.length} компаний...\n`);

    for (let i = 0; i < companies.length; i++) {
        const company = companies[i];
        console.log(`📄 [${i + 1}/${companies.length}] ${company.name}`);
        console.log(`   🔗 ${company.url}`);

        try {
            const contacts = await parseCompanyContacts(company.url);
            
            csvData += `"${company.url}";"${company.name}";"${contacts.site}";"${contacts.phone}";"${contacts.email}"\n`;
            
            // Статистика
            if (contacts.site) { 
                console.log(`   🌐 Сайт: ${contacts.site}`);
                foundContacts.site++; 
            }
            if (contacts.phone) { 
                console.log(`   📞 Телефон: ${contacts.phone}`);
                foundContacts.phone++; 
            }
            if (contacts.email) { 
                console.log(`   ✉️  Email: ${contacts.email}`);
                foundContacts.email++; 
            }
            
            if (contacts.site || contacts.phone || contacts.email) {
                console.log(`   ✅ Контакты найдены`);
                successCount++;
            } else {
                console.log(`   ⚠️  Контакты не найдены`);
                successCount++;
            }

            await delay(CONFIG.DELAY_BETWEEN_COMPANIES);

        } catch (error) {
            console.error(`   ❌ Ошибка: ${error.message}`);
            csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            errorCount++;
        }
        
        console.log(); // Пустая строка
    }

    return {
        csvData,
        successCount,
        errorCount,
        foundContacts
    };
}

// Парсинг контактов компании
async function parseCompanyContacts(companyUrl) {
    try {
        const response = await axios.get(companyUrl, getRequestOptions());
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        let site = '', phone = '', email = '';

        // Ищем блок .sled__end
        const contactsBlock = document.querySelector('.sled__end');
        
        if (contactsBlock) {
            console.log(`   ✓ Блок .sled__end найден`);
            
            // Парсим контакты из блока
            const contacts = parseContactsFromSledEndBlock(contactsBlock);
            site = contacts.site;
            phone = contacts.phone;
            email = contacts.email;
        } else {
            console.log(`   ⚠️  Блок .sled__end не найден`);
        }

        return { site, phone, email };

    } catch (error) {
        console.error(`   ❌ Ошибка загрузки: ${error.message}`);
        return { site: '', phone: '', email: '' };
    }
}

// Парсинг контактов из блока .sled__end
function parseContactsFromSledEndBlock(block) {
    let site = '', phone = '', email = '';
    const html = block.innerHTML;
    const text = block.textContent;
    
    // 1. Ищем ТЕЛЕФОН (в tel: ссылках)
    const telMatch = html.match(/href="tel:([^"]+)"/i);
    if (telMatch) {
        phone = cleanPhone(telMatch[1]);
    }
    
    // 2. Ищем EMAIL (в mailto: ссылках)
    const mailtoMatch = html.match(/href="mailto:([^"]+)"/i);
    if (mailtoMatch) {
        email = mailtoMatch[1];
    }
    
    // 3. Ищем САЙТ (в https? ссылках)
    const siteMatch = html.match(/href="(https?:\/\/[^"]+)"/i);
    if (siteMatch && isValidWebsite(siteMatch[1])) {
        site = cleanWebsite(siteMatch[1]);
    }
    
    // 4. Дополнительный поиск в тексте, если не нашли в ссылках
    if (!phone) {
        const phoneMatch = text.match(PHONE_REGEX);
        if (phoneMatch) {
            phone = cleanPhone(phoneMatch[0]);
        }
    }
    
    if (!email) {
        const emailMatch = text.match(EMAIL_REGEX);
        if (emailMatch) {
            email = emailMatch[0];
        }
    }
    
    if (!site) {
        const urlMatch = text.match(URL_REGEX);
        if (urlMatch && isValidWebsite(urlMatch[0])) {
            site = cleanWebsite(urlMatch[0]);
        }
    }
    
    return { site, phone, email };
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function getRequestOptions() {
    return {
        timeout: CONFIG.TIMEOUT,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://hunting-expo.ru/'
        }
    };
}

function extractCompanyId(url) {
    const match = url.match(/id=(\d+)/);
    return match ? match[1] : '';
}

function isValidWebsite(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.length <= 4 || !lowerUrl.includes('.')) return false;
    
    // Исключаем служебные ссылки
    const excluded = [
        'hunting-expo.ru',
        'mailto:', 'tel:', 'javascript:',
        'facebook.com', 'vk.com', 'instagram.com',
        'whatsapp.com', 't.me', 'youtube.com'
    ];
    
    for (const domain of excluded) {
        if (lowerUrl.includes(domain)) return false;
    }
    
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
    
    // Добавляем протокол если нужно
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
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
        console.log(`💾 Файл сохранен в кодировке Windows-1251`);
    } catch (error) {
        console.warn(`⚠️  Ошибка кодировки, сохраняем в UTF-8`);
        fs.writeFileSync(filename, data, 'utf8');
    }
}

function saveEmptyCSV() {
    const header = 'Ссылка;Название;Сайт;Телефон;Email\n';
    saveToCSV(header, CONFIG.OUTPUT_FILENAME);
    console.log(`💾 Создан пустой CSV файл`);
}

function printStatistics(result, totalCompanies) {
    console.log('\n' + '='.repeat(70));
    console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА:');
    console.log('='.repeat(70));
    console.log(`📊 Всего компаний: ${totalCompanies}`);
    console.log(`✅ Успешно обработано: ${result.successCount}`);
    console.log(`❌ С ошибками: ${result.errorCount}`);
    console.log('─'.repeat(70));
    console.log(`🌐 Найдено сайтов: ${result.foundContacts.site} (${Math.round(result.foundContacts.site/totalCompanies*100)}%)`);
    console.log(`📞 Найдено телефонов: ${result.foundContacts.phone} (${Math.round(result.foundContacts.phone/totalCompanies*100)}%)`);
    console.log(`✉️  Найдено email: ${result.foundContacts.email} (${Math.round(result.foundContacts.email/totalCompanies*100)}%)`);
    console.log(`💾 Файл: ${CONFIG.OUTPUT_FILENAME}`);
    console.log('='.repeat(70));
}

// Запуск парсера
parseExhibition();