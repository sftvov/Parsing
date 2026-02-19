const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// Настройки
const API_URL = 'https://www.interior-expo.ru/local/ajax/components/shows_participants.php';
const OUTPUT_FILENAME = 'interior-expo-companies.csv';
const USE_ANSI_ENCODING = true;

// Параметры из Network payload
const payload = {
    page: 1,
    undefined: undefined,
    request_mode: 'ajax',
    site_id: 's7',
    lang: 'ru'
};

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг Interior Expo...');
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        let currentPage = 1;
        let hasMorePages = true;
        
        while (hasMorePages) {
            console.log(`\n=== Обрабатываем страницу: ${currentPage} ===`);
            
            // Обновляем номер страницы в payload
            const currentPayload = {
                ...payload,
                page: currentPage
            };
            
            try {
                // Отправляем POST запрос с параметрами формы
                const response = await axios.post(API_URL, new URLSearchParams(currentPayload), {
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                const dom = new JSDOM(response.data);
                const document = dom.window.document;
                
                // Ищем карточки компаний по классу .item
                const companyCards = document.querySelectorAll('.item[data-id]');
                console.log(`Найдено компаний на странице: ${companyCards.length}`);
                
                if (companyCards.length === 0) {
                    console.log('Не найдено компаний - завершаем парсинг');
                    hasMorePages = false;
                    break;
                }
                
                // Обрабатываем каждую компанию на странице
                for (let i = 0; i < companyCards.length; i++) {
                    const card = companyCards[i];
                    
                    try {
                        let name = '';
                        let site = '';
                        let phone = '';
                        let email = '';
                        let companyUrl = '';
                        
                        // Извлекаем название и ссылку из карточки
                        const nameElement = card.querySelector('a.name');
                        if (nameElement) {
                            name = nameElement.textContent.trim();
                            companyUrl = nameElement.href;
                            // Делаем URL абсолютным если нужно
                            if (companyUrl.startsWith('/')) {
                                companyUrl = 'https://www.interior-expo.ru' + companyUrl;
                            }
                        }
                        
                        console.log(`\nОбрабатываем [${i + 1}/${companyCards.length}]: ${name}`);
                        console.log(`URL: ${companyUrl}`);
                        
                        // Переходим на детальную страницу для получения контактов
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
                                
                                // Поиск сайта в блоке .members-block
                                const siteElement = detailDoc.querySelector('.members-block a[href^="http"]:not([href*="interior-expo.ru"])');
                                if (siteElement) {
                                    site = siteElement.href;
                                    // Убираем лишние пробелы
                                    site = site.replace(/\s+/g, '').trim();
                                }
                                
                                // Поиск email
                                const emailElement = detailDoc.querySelector('a[href^="mailto:"]');
                                if (emailElement) {
                                    email = emailElement.href.replace('mailto:', '').trim();
                                }
                                
                                // Поиск телефона - ищем элемент с текстом "Телефоны:"
                                const allSpans = detailDoc.querySelectorAll('span');
                                let phonesSpan = null;
                                
                                for (const span of allSpans) {
                                    if (span.textContent.includes('Телефоны:') || span.textContent.includes('Телефон:')) {
                                        phonesSpan = span;
                                        break;
                                    }
                                }
                                
                                if (phonesSpan) {
                                    // Ищем следующий элемент после span с телефонами
                                    let phoneText = '';
                                    const nextElement = phonesSpan.nextElementSibling;
                                    
                                    if (nextElement && nextElement.tagName === 'SPAN') {
                                        phoneText = nextElement.textContent;
                                    } else {
                                        // Если нет отдельного span, берем текст из родительского элемента
                                        phoneText = phonesSpan.parentElement.textContent;
                                    }
                                    
                                    // Извлекаем телефоны с помощью регулярного выражения
                                    const phoneRegex = /(\+?[78]|\+\s?7)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g;
                                    const phoneMatches = phoneText.match(phoneRegex);
                                    if (phoneMatches) {
                                        phone = phoneMatches.join(', ');
                                    }
                                }
                                
                                // Альтернативный поиск по всему тексту страницы
                                const detailText = detailDoc.body.textContent;
                                
                                // Поиск сайта регулярным выражением (если не нашли через селектор)
                                if (!site) {
                                    const siteRegex = /(https?:\/\/[^\s]+)/g;
                                    const siteMatches = detailText.match(siteRegex);
                                    if (siteMatches) {
                                        const validSites = siteMatches.filter(s => 
                                            !s.includes('interior-expo.ru') && 
                                            !s.includes('mailto:') &&
                                            s.length > 10
                                        );
                                        if (validSites.length > 0) {
                                            site = validSites[0];
                                        }
                                    }
                                }
                                
                                // Поиск email регулярным выражением (если не нашли через селектор)
                                if (!email) {
                                    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
                                    const emailMatches = detailText.match(emailRegex);
                                    if (emailMatches) {
                                        email = emailMatches[0];
                                    }
                                }
                                
                                // Поиск телефона регулярным выражением (если не нашли через селектор)
                                if (!phone) {
                                    const phoneRegex = /(\+?[78]|\+\s?7)[\s(-]*\d{3}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}/g;
                                    const phoneMatches = detailText.match(phoneRegex);
                                    if (phoneMatches) {
                                        phone = phoneMatches.join(', ');
                                    }
                                }
                                
                                await delay(1500); // Задержка между запросами к детальным страницам
                                
                            } catch (detailError) {
                                console.log(`  Не удалось загрузить детальную страницу: ${detailError.message}`);
                            }
                        }
                        
                        // Очищаем данные
                        const cleanName = name.replace(/"/g, '""').trim();
                        const cleanSite = (site || '').replace(/"/g, '""').trim();
                        const cleanPhone = (phone || '').replace(/"/g, '""').trim();
                        const cleanEmail = (email || '').replace(/"/g, '""').trim();
                        const cleanUrl = (companyUrl || '').replace(/"/g, '""').trim();
                        
                        // Добавляем в CSV
                        csvData += `"${cleanUrl}";"${cleanName}";"${cleanSite}";"${cleanPhone}";"${cleanEmail}"\n`;
                        
                        console.log(`  Найдено: Сайт: ${cleanSite || 'нет'}, Телефон: ${cleanPhone || 'нет'}, Email: ${cleanEmail || 'нет'}`);
                        
                    } catch (cardError) {
                        console.error(`  Ошибка при обработке карточки ${i + 1}:`, cardError.message);
                        
                        // Добавляем строку с ошибкой
                        const nameElement = card.querySelector('a.name');
                        const companyName = nameElement ? nameElement.textContent.trim() : `Компания ${i + 1}`;
                        const companyUrl = nameElement ? nameElement.href : '';
                        csvData += `"${companyUrl}";"${companyName.replace(/"/g, '""')}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
                    }
                }
                
                // Проверяем есть ли следующая страница
                currentPage++;
                
                // Ограничим количество страниц для теста
                if (currentPage > 12) {
                    console.log('\nДостигнут лимит страниц для теста');
                    hasMorePages = false;
                }
                
                // Задержка между страницами
                await delay(3000);
                
            } catch (pageError) {
                console.error(`Ошибка при загрузке страницы ${currentPage}:`, pageError.message);
                hasMorePages = false;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`\n✅ Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла общая ошибка:', error.message);
    }
}

// Вспомогательные функции
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToFile(data, filename) {
    try {
        if (USE_ANSI_ENCODING) {
            const iconv = require('iconv-lite');
            const buffer = iconv.encode(data, 'win1251');
            fs.writeFileSync(filename, buffer);
        } else {
            const BOM = '\uFEFF';
            fs.writeFileSync(filename, BOM + data, 'utf8');
        }
        console.log(`Файл успешно сохранен: ${filename}`);
    } catch (error) {
        console.error('Ошибка при сохранении файла:', error.message);
    }
}

// Запускаем парсинг
parseCompanies();