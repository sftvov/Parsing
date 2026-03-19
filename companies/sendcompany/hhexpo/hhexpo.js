const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const iconv = require('iconv-lite');

// НАСТРОЙКИ ДЛЯ САЙТА CHEMICOS
const BASE_URL = 'https://hhexpo.ru/catalogue/exhibitors-2026';
const OUTPUT_FILENAME = 'hhexpo2026.csv';
const USE_ANSI_ENCODING = true;
const COMPANIES_PER_PAGE = 40; // Шаг пагинации

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ ДЛЯ ПОИСКА
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90|\+\s?380)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseCompanies() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 ПАРСЕР: CHEMICOS 2026');
        console.log('='.repeat(60));
        console.log(`🌐 Базовая страница: ${BASE_URL}`);
        console.log(`📁 Файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(60) + '\n');

        // Собираем все компании со всех страниц
        const allCompanies = await getAllCompanies();
        
        if (allCompanies.length === 0) {
            console.log('❌ Компании не найдены. Проверьте соединение или структуру сайта.');
            saveEmptyCSV();
            return;
        }

        console.log(`✅ Всего найдено компаний: ${allCompanies.length}\n`);

        // Подготовка данных для CSV с новым полем "Страна"
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
        let successCount = 0;
        let errorCount = 0;
        let foundContacts = { site: 0, phone: 0, email: 0, country: 0 };

        // Обрабатываем каждую компанию
        for (let i = 0; i < allCompanies.length; i++) {
            const company = allCompanies[i];
            console.log(`📄 [${i + 1}/${allCompanies.length}] ${company.name}`);
            console.log(`   🔗 ${company.url}`);

            try {
                const contacts = await parseCompanyContacts(company.url);
                
                // Добавляем данные в CSV с новым полем
                csvData += `"${company.url}";"${company.name}";"${contacts.site}";"${contacts.phone}";"${contacts.email}";"${contacts.country}"\n`;
                
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
                if (contacts.country) { 
                    found.push('страна'); 
                    foundContacts.country++; 
                }
                
                if (found.length > 0) {
                    console.log(`   ✅ Найдено: ${found.join(', ')}`);
                } else {
                    console.log(`   ⚠️  Контакты не найдены`);
                }
                
                successCount++;

                // Задержка между запросами
                await delay(1500);

            } catch (error) {
                console.error(`   ❌ Ошибка: ${error.message}`);
                csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
                errorCount++;
            }
            console.log();
        }

        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        
        // Статистика
        console.log('\n' + '='.repeat(60));
        console.log('📊 СТАТИСТИКА:');
        console.log('='.repeat(60));
        console.log(`✅ Успешно обработано: ${successCount}`);
        console.log(`❌ С ошибками: ${errorCount}`);
        console.log(`📊 Всего компаний: ${allCompanies.length}`);
        console.log('─'.repeat(60));
        console.log(`🌐 Найдено сайтов: ${foundContacts.site}`);
        console.log(`📞 Найдено телефонов: ${foundContacts.phone}`);
        console.log(`✉️  Найдено email: ${foundContacts.email}`);
        console.log(`🌍 Найдено стран: ${foundContacts.country}`);
        console.log(`💾 Файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Получение списка всех компаний со всех страниц
async function getAllCompanies() {
    const allCompanies = [];
    let start = 0;
    let pageNumber = 1;
    let hasMorePages = true;

    console.log('🔍 Собираем список компаний по страницам...');

    while (hasMorePages && pageNumber <= 20) { // Максимум 20 страниц для защиты
        try {
            const pageUrl = start === 0 ? BASE_URL : `${BASE_URL}?pseudo=${start}`;
            console.log(`\n   📄 Страница ${pageNumber}: ${pageUrl}`);

            const companies = await parseCompaniesPage(pageUrl);
            
            console.log(`   📊 Найдено на странице: ${companies.length} компаний`);
            
            if (companies.length > 0) {
                allCompanies.push(...companies);
            }

            // Проверяем, есть ли еще страницы
            if (companies.length < COMPANIES_PER_PAGE) {
                hasMorePages = false;
                console.log(`   ⏹️  Это последняя страница`);
            } else {
                start += COMPANIES_PER_PAGE;
                pageNumber++;
            }

            await delay(2000); // Задержка между страницами

        } catch (error) {
            console.error(`   ❌ Ошибка при загрузке страницы ${pageNumber}:`, error.message);
            hasMorePages = false;
        }
    }

    console.log(`\n📈 Всего собрано компаний: ${allCompanies.length}`);
    return allCompanies;
}

// Парсинг одной страницы со списком компаний
async function parseCompaniesPage(pageUrl) {
    try {
        const response = await axios.get(pageUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        
        const companies = [];
        
        // ИСПРАВЛЕННЫЙ СЕЛЕКТОР: tr td > a
        // Находим все ссылки, которые находятся непосредственно в td внутри tr
        const linkElements = document.querySelectorAll('tr td > a');
        console.log(`   🔍 Найдено ссылок по селектору "tr td > a": ${linkElements.length}`);

        for (const linkElement of linkElements) {
            try {
                const href = linkElement.getAttribute('href');
                const name = linkElement.textContent.trim();
                
                if (href && name && name.length > 0) {
                    // Преобразуем относительную ссылку в абсолютную
                    const fullUrl = href.startsWith('http') 
                        ? href 
                        : `https://chemicos.ru${href.startsWith('/') ? href : '/' + href}`;
                    
                    companies.push({
                        name: cleanText(name),
                        url: fullUrl
                    });
                    
                    console.log(`   ✓ ${name.substring(0, 50)}...`);
                }
            } catch (error) {
                console.error('   Ошибка обработки ссылки:', error.message);
            }
        }
        
        return companies;

    } catch (error) {
        console.error(`Ошибка парсинга страницы ${pageUrl}:`, error.message);
        return [];
    }
}

// Парсинг контактов компании
async function parseCompanyContacts(companyUrl) {
    try {
        const response = await axios.get(companyUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        let site = '', phone = '', email = '', country = '';

        // Ищем блок .sppb-addon-content
        const contentBlock = document.querySelector('.sppb-addon-content');
        
        if (contentBlock) {
            console.log(`   ✓ Блок .sppb-addon-content найден`);
            
            // Получаем текст блока
            const blockText = contentBlock.textContent;
            const blockHtml = contentBlock.innerHTML;
            
            // 1. Ищем EMAIL (самый надежный способ - через mailto)
            const mailtoMatch = blockHtml.match(/mailto:([^"'\s]+)/i);
            if (mailtoMatch) {
                email = mailtoMatch[1];
            }
            
            // Если не нашли через mailto, ищем в тексте
            if (!email) {
                const emailMatch = blockText.match(EMAIL_REGEX);
                if (emailMatch) {
                    // Выбираем первый не-служебный email
                    for (const em of emailMatch) {
                        if (!em.includes('noreply') && !em.includes('no-reply')) {
                            email = em;
                            break;
                        }
                    }
                }
            }
            
            // 2. Ищем САЙТ
            // Сначала по меткам
            const siteLabels = ['Сайт:', 'Website:', 'Веб-сайт:'];
            for (const label of siteLabels) {
                const siteMatch = blockText.match(new RegExp(`${label}\\s*([^\\n<]+)`, 'i'));
                if (siteMatch) {
                    const urlMatch = siteMatch[1].match(URL_REGEX);
                    if (urlMatch && isValidWebsite(urlMatch[0])) {
                        site = cleanWebsite(urlMatch[0]);
                        break;
                    }
                }
            }
            
            // Если не нашли по меткам, ищем все ссылки в блоке
            if (!site) {
                const links = contentBlock.querySelectorAll('a[href]');
                for (const link of links) {
                    const href = link.getAttribute('href');
                    if (href && isValidWebsite(href)) {
                        site = cleanWebsite(href);
                        break;
                    }
                }
            }
            
            // 3. Ищем ТЕЛЕФОН
            const phoneLabels = ['Телефон:', 'Тел:', 'Phone:'];
            for (const label of phoneLabels) {
                const phoneMatch = blockText.match(new RegExp(`${label}\\s*([^\\n<]+)`, 'i'));
                if (phoneMatch) {
                    const phoneNumberMatch = phoneMatch[1].match(PHONE_REGEX);
                    if (phoneNumberMatch) {
                        phone = cleanPhone(phoneNumberMatch[0]);
                        break;
                    }
                }
            }
            
            // Если не нашли по меткам, ищем все телефоны
            if (!phone) {
                const allPhones = blockText.match(PHONE_REGEX);
                if (allPhones && allPhones.length > 0) {
                    phone = cleanPhone(allPhones[0]);
                }
            }
            
            // 4. Ищем СТРАНУ - НОВОЕ ПОЛЕ
            const countryLabels = ['Страна:', 'Страна производства:', 'Страна производитель:'];
            for (const label of countryLabels) {
                const countryMatch = blockText.match(new RegExp(`${label}\\s*([^\\n<]+)`, 'i'));
                if (countryMatch) {
                    // Извлекаем текст после метки и чистим
                    let countryText = countryMatch[1].trim();
                    
                    // Убираем возможные HTML теги
                    countryText = countryText.replace(/<[^>]*>/g, '').trim();
                    
                    // Проверяем, что это похоже на название страны (не URL, не телефон и т.д.)
                    if (countryText && 
                        countryText.length > 2 && 
                        countryText.length < 50 && 
                        !countryText.includes('@') && 
                        !countryText.includes('http') &&
                        !countryText.match(/^[\d\s\+\(\)-]+$/)) { // Не телефон
                        
                        country = countryText;
                        console.log(`   🌍 Найдена страна: ${country}`);
                        break;
                    }
                }
            }
            
            // Если не нашли по меткам, ищем простой текст с названием страны в начале строки
            if (!country) {
                // Разбиваем текст на строки и ищем строки, которые могут содержать название страны
                const lines = blockText.split('\n');
                for (const line of lines) {
                    const trimmed = line.trim();
                    // Ищем строки, которые не содержат спецсимволов и похожи на названия стран
                    if (trimmed && 
                        trimmed.length > 2 && 
                        trimmed.length < 30 && 
                        !trimmed.includes('@') && 
                        !trimmed.includes('http') &&
                        !trimmed.includes('Телефон') &&
                        !trimmed.includes('Сайт') &&
                        !trimmed.includes('Email') &&
                        !trimmed.match(/^[\d\s\+\(\)-]+$/)) {
                        
                        // Проверяем по списку распространенных стран
                        const commonCountries = ['Россия', 'Беларусь', 'Казахстан', 'Китай', 'Германия', 'Италия', 'Франция', 'США', 'Турция', 'Индия'];
                        for (const knownCountry of commonCountries) {
                            if (trimmed.includes(knownCountry)) {
                                country = trimmed;
                                console.log(`   🌍 Найдена страна (по списку): ${country}`);
                                break;
                            }
                        }
                        if (country) break;
                    }
                }
            }
            
        } else {
            console.log(`   ⚠️  Блок .sppb-addon-content не найден`);
            
            // Пробуем найти контакты по всей странице
            const pageText = document.body.textContent;
            
            const emailMatch = pageText.match(EMAIL_REGEX);
            email = emailMatch ? emailMatch[0] : '';
            
            const phoneMatch = pageText.match(PHONE_REGEX);
            phone = phoneMatch ? cleanPhone(phoneMatch[0]) : '';
            
            const siteMatch = pageText.match(URL_REGEX);
            if (siteMatch) {
                for (const url of siteMatch) {
                    if (isValidWebsite(url)) {
                        site = cleanWebsite(url);
                        break;
                    }
                }
            }
            
            // Поиск страны по всей странице
            const countryMatch = pageText.match(/Страна:\s*([А-ЯЁ][а-яё]+(?:\s[А-ЯЁ][а-яё]+)*)/i);
            if (countryMatch) {
                country = countryMatch[1].trim();
            }
        }

        return { site, phone, email, country };

    } catch (error) {
        console.error(`   ❌ Ошибка загрузки: ${error.message}`);
        return { site: '', phone: '', email: '', country: '' };
    }
}

// Вспомогательные функции
function isValidWebsite(url) {
    if (!url) return false;
    
    const lowerUrl = url.toLowerCase();
    
    if (lowerUrl.length <= 4 || !lowerUrl.includes('.')) return false;
    
    // Исключаем служебные ссылки и домены выставки
    const excluded = [
        'chemicos.ru',
        'hhexpo.ru',
        'mailto:', 'tel:', 'javascript:',
        'facebook.com', 'vk.com', 'instagram.com',
        'youtube.com', 't.me'
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
    
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return 'https://' + url;
    }
    
    return url;
}

function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToFile(data, filename) {
    try {
        if (USE_ANSI_ENCODING) {
            const buffer = iconv.encode(data, 'win1251');
            fs.writeFileSync(filename, buffer);
            console.log(`💾 Файл сохранен в Windows-1251`);
        } else {
            const BOM = '\uFEFF';
            fs.writeFileSync(filename, BOM + data, 'utf8');
            console.log(`💾 Файл сохранен в UTF-8 с BOM`);
        }
    } catch (error) {
        console.error('❌ Ошибка при сохранении файла:', error.message);
        // Пробуем сохранить без кодировки
        fs.writeFileSync(filename, data, 'utf8');
    }
}

function saveEmptyCSV() {
    const header = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
    saveToFile(header, OUTPUT_FILENAME);
    console.log(`💾 Создан пустой CSV файл: ${OUTPUT_FILENAME}`);
}

// Запуск парсера
parseCompanies();