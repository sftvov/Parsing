const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ - ИЗМЕНЯЙТЕ ЗДЕСЬ ДЛЯ РАЗНЫХ САЙТОВ
const CONFIG = {
    // API URL для получения списка компаний
    apiUrl: 'https://www.aquasalon-expo.ru/local/ajax/components/shows_participants.php',
    
    // Параметры POST запроса (если нужны)
    payload: {
    },
    
    // Селекторы для списка компаний
    listSelectors: {
        cardSelector: '.item[data-id]',           // Селектор карточки компании
        nameSelector: 'a.name',                   // Селектор названия и ссылки
        urlPrefix: 'https://www.aquasalon-expo.ru' // Префикс для относительных URL
    },
    
    // Селекторы для детальной страницы
    detailSelectors: {
        siteSelector: '.members-block a[href^="http"]:not([href*="aquasalon-expo.ru"])',
        emailSelector: 'a[href^="mailto:"]',
        phoneSpanText: ['Телефоны:', 'Телефон:'],
        countrySelector: '.participant__location'  // Селектор для страны
    },
    
    // Настройки парсинга
    maxPages: 20,           // Максимальное количество страниц (0 - без лимита)
    delayBetweenPages: 3000,   // Задержка между страницами (мс)
    delayBetweenDetails: 1500,  // Задержка между детальными страницами (мс)
    testMode: false,        // Режим тестирования (остановится после 1 страницы)
    
    // Настройки вывода
    outputFilename: 'aquasalon-expo-companies.csv',
    useAnsiEncoding: true
};

// Регулярные выражения для поиска
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?[78]|\+\s?7)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g;
const SITE_REGEX = /(https?:\/\/[^\s]+)/g;

async function parseCompanies() {
    try {
        console.log('='.repeat(60));
        console.log(`🚀 ПАРСЕР: ${CONFIG.apiUrl.split('/')[2]}`);
        console.log('='.repeat(60));
        console.log(`📁 Файл: ${CONFIG.outputFilename}`);
        console.log('='.repeat(60) + '\n');
        
        // Подготовка данных для CSV с полем "Страна"
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
        
        let currentPage = 1;
        let hasMorePages = true;
        let totalCompanies = 0;
        
        while (hasMorePages && (CONFIG.maxPages === 0 || currentPage <= CONFIG.maxPages)) {
            console.log(`\n📄 Обрабатываем страницу: ${currentPage}`);
            
            // Формируем payload с текущей страницей
            const currentPayload = {
                ...CONFIG.payload,
                page: currentPage
            };
            
            try {
                // Отправляем POST запрос
                const response = await axios.post(CONFIG.apiUrl, new URLSearchParams(currentPayload), {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                const dom = new JSDOM(response.data);
                const document = dom.window.document;
                
                // Ищем карточки компаний
                const companyCards = document.querySelectorAll(CONFIG.listSelectors.cardSelector);
                console.log(`   Найдено компаний на странице: ${companyCards.length}`);
                
                if (companyCards.length === 0) {
                    console.log('   ⏹️  Компании не найдены - завершаем парсинг');
                    hasMorePages = false;
                    break;
                }
                
                // Обрабатываем каждую компанию
                for (let i = 0; i < companyCards.length; i++) {
                    const card = companyCards[i];
                    totalCompanies++;
                    
                    try {
                        let name = '';
                        let site = '';
                        let phone = '';
                        let email = '';
                        let country = '';
                        let companyUrl = '';
                        
                        // Извлекаем название и ссылку
                        const nameElement = card.querySelector(CONFIG.listSelectors.nameSelector);
                        if (nameElement) {
                            name = nameElement.textContent.trim();
                            companyUrl = nameElement.href;
                            // Делаем URL абсолютным
                            if (companyUrl && companyUrl.startsWith('/')) {
                                companyUrl = CONFIG.listSelectors.urlPrefix + companyUrl;
                            }
                        }
                        
                        console.log(`\n📌 [${totalCompanies}] ${name || 'Без названия'}`);
                        if (companyUrl) console.log(`   🔗 ${companyUrl}`);
                        
                        // Переходим на детальную страницу
                        if (companyUrl) {
                            try {
                                const detailResponse = await axios.get(companyUrl, {
                                    timeout: 10000,
                                    headers: {
                                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                                    }
                                });
                                const detailDom = new JSDOM(detailResponse.data);
                                const detailDoc = detailDom.window.document;
                                
                                // 1. Поиск САЙТА
                                if (CONFIG.detailSelectors.siteSelector) {
                                    const siteElement = detailDoc.querySelector(CONFIG.detailSelectors.siteSelector);
                                    if (siteElement && siteElement.href) {
                                        site = siteElement.href.replace(/\s+/g, '').trim();
                                    }
                                }
                                
                                // 2. Поиск EMAIL
                                if (CONFIG.detailSelectors.emailSelector) {
                                    const emailElement = detailDoc.querySelector(CONFIG.detailSelectors.emailSelector);
                                    if (emailElement) {
                                        email = emailElement.href.replace('mailto:', '').trim();
                                    }
                                }
                                
                                // 3. Поиск СТРАНЫ (новое поле)
                                if (CONFIG.detailSelectors.countrySelector) {
                                    const countryElement = detailDoc.querySelector(CONFIG.detailSelectors.countrySelector);
                                    if (countryElement) {
                                        country = countryElement.textContent.trim();
                                    }
                                }
                                
                                // 4. Поиск ТЕЛЕФОНА по тексту "Телефоны:"
                                const allSpans = detailDoc.querySelectorAll('span');
                                let phonesSpan = null;
                                
                                for (const span of allSpans) {
                                    const spanText = span.textContent;
                                    if (CONFIG.detailSelectors.phoneSpanText.some(text => spanText.includes(text))) {
                                        phonesSpan = span;
                                        break;
                                    }
                                }
                                
                                if (phonesSpan) {
                                    let phoneText = '';
                                    const nextElement = phonesSpan.nextElementSibling;
                                    
                                    if (nextElement && nextElement.tagName === 'SPAN') {
                                        phoneText = nextElement.textContent;
                                    } else {
                                        phoneText = phonesSpan.parentElement.textContent;
                                    }
                                    
                                    const phoneMatches = phoneText.match(PHONE_REGEX);
                                    if (phoneMatches) {
                                        phone = phoneMatches.join(', ');
                                    }
                                }
                                
                                // Альтернативный поиск по тексту страницы
                                const detailText = detailDoc.body.textContent;
                                
                                if (!site) {
                                    const siteMatches = detailText.match(SITE_REGEX);
                                    if (siteMatches) {
                                        const validSites = siteMatches.filter(s => 
                                            !s.includes(CONFIG.apiUrl.split('/')[2]) && 
                                            !s.includes('mailto:') &&
                                            s.length > 10
                                        );
                                        if (validSites.length > 0) {
                                            site = validSites[0];
                                        }
                                    }
                                }
                                
                                if (!email) {
                                    const emailMatches = detailText.match(EMAIL_REGEX);
                                    if (emailMatches) {
                                        email = emailMatches[0];
                                    }
                                }
                                
                                if (!phone) {
                                    const phoneMatches = detailText.match(PHONE_REGEX);
                                    if (phoneMatches) {
                                        phone = phoneMatches.join(', ');
                                    }
                                }
                                
                                await delay(CONFIG.delayBetweenDetails);
                                
                            } catch (detailError) {
                                console.log(`   ⚠️  Не удалось загрузить детальную страницу: ${detailError.message}`);
                            }
                        }
                        
                        // Очищаем данные
                        const cleanName = cleanText(name);
                        const cleanSite = cleanText(site);
                        const cleanPhone = cleanText(phone);
                        const cleanEmail = cleanText(email);
                        const cleanCountry = cleanText(country);
                        const cleanUrl = cleanText(companyUrl);
                        
                        // Добавляем в CSV с полем "Страна"
                        csvData += `"${cleanUrl}";"${cleanName}";"${cleanSite}";"${cleanPhone}";"${cleanEmail}";"${cleanCountry}"\n`;
                        
                        console.log(`   🌐 Сайт: ${cleanSite || 'нет'}`);
                        console.log(`   📞 Телефон: ${cleanPhone || 'нет'}`);
                        console.log(`   ✉️  Email: ${cleanEmail || 'нет'}`);
                        console.log(`   🌍 Страна: ${cleanCountry || 'нет'}`);
                        
                    } catch (cardError) {
                        console.error(`   ❌ Ошибка при обработке карточки: ${cardError.message}`);
                        const nameElement = card.querySelector(CONFIG.listSelectors.nameSelector);
                        const companyName = nameElement ? nameElement.textContent.trim() : `Компания ${totalCompanies}`;
                        const companyUrl = nameElement ? nameElement.href : '';
                        csvData += `"${companyUrl}";"${cleanText(companyName)}";"ОШИБКА";"ОШИБКА";"ОШИБКА";""\n`;
                    }
                }
                
                // Проверяем следующую страницу
                currentPage++;
                
                if (CONFIG.testMode && currentPage > 1) {
                    console.log('\n🔧 Тестовый режим: остановка после первой страницы');
                    hasMorePages = false;
                }
                
                if (hasMorePages) {
                    await delay(CONFIG.delayBetweenPages);
                }
                
            } catch (pageError) {
                console.error(`   ❌ Ошибка при загрузке страницы ${currentPage}:`, pageError.message);
                hasMorePages = false;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, CONFIG.outputFilename);
        
        // Статистика
        console.log('\n' + '='.repeat(60));
        console.log('📊 СТАТИСТИКА:');
        console.log('='.repeat(60));
        console.log(`✅ Обработано компаний: ${totalCompanies}`);
        console.log(`📁 Файл: ${CONFIG.outputFilename}`);
        console.log('='.repeat(60));
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    }
}

// Вспомогательные функции
function cleanText(text) {
    if (!text) return '';
    return text.replace(/"/g, '""').trim();
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToFile(data, filename) {
    try {
        if (CONFIG.useAnsiEncoding) {
            const iconv = require('iconv-lite');
            const buffer = iconv.encode(data, 'win1251');
            fs.writeFileSync(filename, buffer);
            console.log(`💾 Файл сохранен в кодировке Windows-1251`);
        } else {
            const BOM = '\uFEFF';
            fs.writeFileSync(filename, BOM + data, 'utf8');
            console.log(`💾 Файл сохранен в кодировке UTF-8 с BOM`);
        }
    } catch (error) {
        console.error('❌ Ошибка при сохранении файла:', error.message);
        fs.writeFileSync(filename, data, 'utf8');
    }
}

// Запускаем парсинг
parseCompanies();