const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const iconv = require('iconv-lite');

// НАСТРОЙКИ
const BASE_URL = 'https://ruplastica-online.ru/expositions/exposition/131-ruplastica-2026.html';
const OUTPUT_FILENAME = 'ruplastica-companies.csv';
const COMPANIES_PER_PAGE = 48; // Типичный шаг пагинации

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ для поиска контактов
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseExhibition() {
    try {
        console.log(`🚀 Начинаем парсинг выставки Ruplastica 2026...`);
        console.log(`🌐 Основная страница: ${BASE_URL}\n`);

        // 1. Получаем список всех компаний
        const allCompanies = await getAllCompanies();
        console.log(`✅ Всего найдено компаний: ${allCompanies.length}\n`);

        if (allCompanies.length === 0) {
            console.log('❌ Не найдено ни одной компании для обработки.');
            return;
        }

        // 2. Подготавливаем CSV файл
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';

        // 3. Обрабатываем каждую компанию
        for (let i = 0; i < allCompanies.length; i++) {
            const company = allCompanies[i];
            console.log(`📄 Обрабатываем компанию [${i + 1}/${allCompanies.length}]: ${company.name}`);
            console.log(`   Ссылка: ${company.url}`);

            try {
                const contacts = await parseCompanyContacts(company.url);
                
                // Добавляем данные в CSV
                csvData += `"${company.url}";"${company.name}";"${contacts.site}";"${contacts.phone}";"${contacts.email}"\n`;

                console.log(`   ✅ Найдено: Сайт: ${contacts.site || 'нет'}, Телефон: ${contacts.phone || 'нет'}, Email: ${contacts.email || 'нет'}`);

                // Задержка между запросами, чтобы не перегружать сервер
                await delay(1000 + Math.random() * 500);

            } catch (error) {
                console.error(`   ❌ Ошибка при обработке: ${error.message}`);
                // Добавляем строку с ошибкой в CSV
                csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
            console.log(); // Пустая строка для разделения
        }

        // 4. Сохраняем результат в CSV
        saveToCSV(csvData, OUTPUT_FILENAME);
        console.log(`\n🎉 Парсинг завершен! Данные сохранены в файл: ${OUTPUT_FILENAME}`);

    } catch (error) {
        console.error('💥 Критическая ошибка при парсинге:', error.message);
    }
}

// Функция для получения списка всех компаний со всех страниц
async function getAllCompanies() {
    const allCompanies = [];
    let start = 0;
    let pageNumber = 1;
    let hasMorePages = true;

    console.log('🔍 Собираем список компаний...');

    while (hasMorePages) {
        try {
            const pageUrl = start === 0 ? BASE_URL : `${BASE_URL}?start=${start}`;
            console.log(`   Страница ${pageNumber}: ${pageUrl}`);

            const companies = await parseCompaniesPage(pageUrl);
            
            if (companies.length > 0) {
                allCompanies.push(...companies);
                console.log(`   Найдено на странице: ${companies.length} компаний`);

                // Проверяем, есть ли еще страницы
                if (companies.length < COMPANIES_PER_PAGE) {
                    hasMorePages = false;
                    console.log('   Это последняя страница');
                } else {
                    start += COMPANIES_PER_PAGE;
                    pageNumber++;
                }
            } else {
                hasMorePages = false;
                console.log('   Компании не найдены - завершаем');
            }

            // Задержка между страницами
            await delay(1500);

        } catch (error) {
            console.error(`   Ошибка при получении страницы: ${error.message}`);
            hasMorePages = false;
        }
    }

    return allCompanies;
}

// Парсинг страницы со списком компаний
async function parseCompaniesPage(pageUrl) {
    try {
        const response = await axios.get(pageUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;
        const companies = [];

        // Ищем все элементы компаний в блоке #scroll_list
        const companyElements = document.querySelectorAll('#scroll_list .scroll_item a');

        console.log(`   Найдено элементов-ссылок: ${companyElements.length}`);

        for (const element of companyElements) {
            try {
                // Получаем URL компании
                const companyUrl = element.getAttribute('href');
                if (!companyUrl) continue;

                // ОСОБЕННОСТЬ: Получаем название из .exh_name, игнорируя теги внутри
                const nameElement = element.querySelector('.exh_name');
                let companyName = 'Неизвестное название';
                
                if (nameElement) {
                    // Клонируем элемент, чтобы не изменять оригинал
                    const clone = nameElement.cloneNode(true);
                    
                    // Удаляем все вложенные теги (img и другие)
                    const childElements = clone.querySelectorAll('*');
                    childElements.forEach(child => child.remove());
                    
                    // Получаем только текстовое содержимое корня
                    companyName = clone.textContent.trim();
                }

                // Если не удалось получить название, пробуем альтернативные способы
                if (!companyName || companyName === 'Неизвестное название') {
                    // Пробуем получить title у ссылки
                    companyName = element.getAttribute('title') || 
                                  element.textContent.trim() || 
                                  'Неизвестное название';
                }

                // Преобразуем относительный URL в абсолютный
                const fullUrl = companyUrl.startsWith('http') 
                    ? companyUrl 
                    : `https://ruplastica-online.ru${companyUrl.startsWith('/') ? companyUrl : '/' + companyUrl}`;

                // Проверяем, что это действительно страница компании
                if (fullUrl.includes('/company/') || fullUrl.includes('/companies/')) {
                    companies.push({
                        name: cleanText(companyName),
                        url: fullUrl
                    });
                }

            } catch (error) {
                console.error('   Ошибка при обработке элемента компании:', error.message);
            }
        }

        return companies;

    } catch (error) {
        console.error(`Ошибка при парсинге страницы ${pageUrl}:`, error.message);
        return [];
    }
}

// Парсинг контактной информации компании
async function parseCompanyContacts(companyUrl) {
    try {
        const response = await axios.get(companyUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        let site = '';
        let phone = '';
        let email = '';

        // Ищем блок с контактами #tab_contacts_flat
        const contactsBlock = document.querySelector('#tab_contacts_flat');
        
        if (contactsBlock) {
            console.log(`   Блок #tab_contacts_flat найден, извлекаем контакты...`);

            const blockText = contactsBlock.textContent;

            // Поиск сайта
            const siteMatch = blockText.match(/Сайт:?\s*([^\n<]+)/i);
            if (siteMatch) {
                const urlMatch = siteMatch[1].match(URL_REGEX);
                if (urlMatch) {
                    site = cleanWebsite(urlMatch[0]);
                } else {
                    site = cleanWebsite(siteMatch[1].trim());
                }
            }

            // Поиск телефона
            const phoneMatch = blockText.match(/Телефон:?\s*([^\n<]+)/i);
            if (phoneMatch) {
                const phoneNumberMatch = phoneMatch[1].match(PHONE_REGEX);
                if (phoneNumberMatch) {
                    phone = cleanPhone(phoneNumberMatch[0]);
                } else {
                    phone = cleanPhone(phoneMatch[1].trim());
                }
            }

            // Поиск email
            const emailMatch = blockText.match(/Email:?\s*([^\n<]+)/i);
            if (emailMatch) {
                const emailFound = emailMatch[1].match(EMAIL_REGEX);
                if (emailFound) {
                    email = emailFound[0];
                }
            }

            // Альтернативный поиск, если не нашли по меткам
            if (!email) {
                const allEmails = blockText.match(EMAIL_REGEX);
                if (allEmails && allEmails.length > 0) {
                    email = allEmails[0];
                }
            }

            if (!phone) {
                const allPhones = blockText.match(PHONE_REGEX);
                if (allPhones && allPhones.length > 0) {
                    phone = cleanPhone(allPhones[0]);
                }
            }

            if (!site) {
                const allUrls = blockText.match(URL_REGEX);
                if (allUrls) {
                    for (const url of allUrls) {
                        if (isValidWebsite(url)) {
                            site = cleanWebsite(url);
                            break;
                        }
                    }
                }
            }

        } else {
            console.log(`   Блок #tab_contacts_flat не найден, поиск по всей странице...`);
            
            // Если блок не найден, ищем контакты по всей странице
            const pageText = document.body.textContent;
            
            const allEmails = pageText.match(EMAIL_REGEX);
            if (allEmails && allEmails.length > 0) {
                email = allEmails[0];
            }
            
            const allPhones = pageText.match(PHONE_REGEX);
            if (allPhones && allPhones.length > 0) {
                phone = cleanPhone(allPhones[0]);
            }
            
            const allUrls = pageText.match(URL_REGEX);
            if (allUrls) {
                for (const url of allUrls) {
                    if (isValidWebsite(url)) {
                        site = cleanWebsite(url);
                        break;
                    }
                }
            }
        }

        return {
            site: site,
            phone: phone,
            email: email
        };

    } catch (error) {
        console.error(`Ошибка при парсинге компании ${companyUrl}:`, error.message);
        return {
            site: '',
            phone: '',
            email: ''
        };
    }
}

// Вспомогательные функции
function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
}

function cleanWebsite(site) {
    if (!site) return '';
    site = site.trim();
    site = site.replace(/^[^\w]*|[^\w]*$/g, '');
    site = site.split('?')[0].split('#')[0];
    
    if (site && !site.startsWith('http')) {
        site = 'https://' + site;
    }
    
    return site;
}

function isValidWebsite(site) {
    if (!site) return false;
    
    const lowerSite = site.toLowerCase();
    
    const excludedDomains = [
        'ruplastica-online.ru',
        'catalog.iagri-expo.com',
        'agros-expo.com',
        'tildacdn.com',
        'yandex.ru',
        'google.com',
        'vk.com',
        'facebook.com',
        'instagram.com'
    ];
    
    if (lowerSite.includes('mailto:') || 
        lowerSite.includes('tel:') ||
        lowerSite.includes('javascript:') ||
        site.length <= 4 || 
        !site.includes('.') ||
        excludedDomains.some(domain => lowerSite.includes(domain))) {
        return false;
    }
    
    return true;
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
        // Кодируем в Windows-1251 для корректного отображения в Excel
        const buffer = iconv.encode(data, 'win1251');
        fs.writeFileSync(filename, buffer);
        console.log(`💾 Файл сохранен: ${filename} (кодировка: Windows-1251)`);
    } catch (error) {
        // Если произошла ошибка с кодировкой, сохраняем как есть
        console.warn(`⚠️ Не удалось сохранить в Windows-1251, сохраняем в UTF-8`);
        fs.writeFileSync(filename, data, 'utf8');
    }
}

// Запускаем парсинг
parseExhibition();