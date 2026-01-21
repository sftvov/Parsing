const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const iconv = require('iconv-lite');

// НАСТРОЙКИ ДЛЯ AGRAVIA
const BASE_URL = 'https://catalog.agravia.org/expositions/exposition/6228';
const OUTPUT_FILENAME = 'agravia-companies.csv';
const COMPANIES_PER_PAGE = 48;

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseAgraviaExhibition() {
    try {
        console.log(`🚀 Начинаем парсинг выставки AGRAVIA...`);
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
                const contacts = await parseCompanyContactsStrict(company.url);
                
                // Добавляем данные в CSV
                csvData += `"${company.url}";"${company.name}";"${contacts.site}";"${contacts.phone}";"${contacts.email}"\n`;

                console.log(`   ✅ Найдено: Сайт: ${contacts.site || 'нет'}, Телефон: ${contacts.phone || 'нет'}, Email: ${contacts.email || 'нет'}`);

                // Задержка между запросами
                await delay(1000 + Math.random() * 500);

            } catch (error) {
                console.error(`   ❌ Ошибка при обработке: ${error.message}`);
                csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
            console.log();
        }

        // 4. Сохраняем результат
        saveToCSV(csvData, OUTPUT_FILENAME);
        console.log(`\n🎉 Парсинг завершен! Данные сохранены в: ${OUTPUT_FILENAME}`);

    } catch (error) {
        console.error('💥 Критическая ошибка при парсинге:', error.message);
    }
}

// Получаем все компании со всех страниц
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

            await delay(1500);

        } catch (error) {
            console.error(`   Ошибка при получении страницы: ${error.message}`);
            hasMorePages = false;
        }
    }

    return allCompanies;
}

// Парсим страницу со списком компаний
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

        // Ищем компании по указанным селекторам
        const companyElements = document.querySelectorAll('#scroll_list .scroll_item a');

        console.log(`   Найдено элементов-ссылок: ${companyElements.length}`);

        for (const element of companyElements) {
            try {
                const companyUrl = element.getAttribute('href');
                if (!companyUrl) continue;

                const nameElement = element.querySelector('.comp_name');
                const companyName = nameElement ? nameElement.textContent.trim() : 'Неизвестное название';

                // Формируем полный URL
                const fullUrl = companyUrl.startsWith('http') 
                    ? companyUrl 
                    : `https://catalog.agravia.org${companyUrl.startsWith('/') ? companyUrl : '/' + companyUrl}`;

                // Проверяем, что это страница компании
                if (fullUrl.includes('/company/')) {
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

// Парсим контакты компании СТРОГО из блока #tab_contacts_flat
async function parseCompanyContactsStrict(companyUrl) {
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

        let site = '', phone = '', email = '';

        // Ищем блок с контактами СТРОГО
        const contactsBlock = document.querySelector('#tab_contacts_flat');
        
        if (!contactsBlock) {
            console.log(`   ❗ Блок #tab_contacts_flat НЕ НАЙДЕН. Контакты не будут извлечены.`);
            return { site: '', phone: '', email: '' };
        }

        console.log(`   ✅ Блок #tab_contacts_flat найден, извлекаем контакты...`);

        const blockText = contactsBlock.textContent;
        const blockHTML = contactsBlock.innerHTML;

        // 1. Пытаемся найти структурированные данные по классам
        const siteElement = contactsBlock.querySelector('.company_site');
        const phoneElement = contactsBlock.querySelector('.company_phone');
        const emailElement = contactsBlock.querySelector('.company_email');

        if (siteElement) {
            // Пробуем найти ссылку
            const siteLink = siteElement.querySelector('a');
            if (siteLink && siteLink.href) {
                site = cleanWebsite(siteLink.href);
            } else {
                // Ищем URL в тексте
                const siteText = siteElement.textContent;
                const urlMatch = siteText.match(URL_REGEX);
                if (urlMatch && isValidWebsite(urlMatch[0])) {
                    site = cleanWebsite(urlMatch[0]);
                }
            }
        }

        if (phoneElement) {
            const phoneText = phoneElement.textContent;
            const phoneMatch = phoneText.match(PHONE_REGEX);
            if (phoneMatch) {
                phone = cleanPhone(phoneMatch[0]);
            } else {
                phone = cleanPhone(phoneText.replace(/Телефон:/i, '').trim());
            }
        }

        if (emailElement) {
            // Пробуем найти mailto ссылку
            const emailLink = emailElement.querySelector('a[href^="mailto:"]');
            if (emailLink) {
                email = emailLink.href.replace('mailto:', '').trim();
            } else {
                // Ищем email в тексте
                const emailText = emailElement.textContent;
                const emailMatch = emailText.match(EMAIL_REGEX);
                if (emailMatch) {
                    email = emailMatch[0];
                } else {
                    email = emailText.replace(/Email:|E-mail:/i, '').trim();
                }
            }
        }

        // 2. Если не нашли по классам, ищем по текстовым меткам в блоке
        if (!site || !phone || !email) {
            // Разделяем текст блока на строки для анализа
            const lines = blockText.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0);

            for (const line of lines) {
                // Поиск сайта
                if (!site && (line.includes('Сайт:') || line.includes('сайт:'))) {
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

                // Поиск телефона
                if (!phone && (line.includes('Телефон:') || line.includes('Тел:'))) {
                    const phoneMatch = line.match(PHONE_REGEX);
                    if (phoneMatch) {
                        phone = cleanPhone(phoneMatch[0]);
                    }
                }

                // Поиск email
                if (!email && (line.includes('Email:') || line.includes('E-mail:'))) {
                    const emailMatch = line.match(EMAIL_REGEX);
                    if (emailMatch) {
                        email = emailMatch[0];
                    }
                }
            }
        }

        // 3. Если всё еще не нашли, ищем во всем тексте блока
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

        // 4. Проверяем, что найденные контакты действительно из блока #tab_contacts_flat
        console.log(`   📊 Результат из блока #tab_contacts_flat:`);
        console.log(`      - Сайт: ${site || 'не найден'}`);
        console.log(`      - Телефон: ${phone || 'не найден'}`);
        console.log(`      - Email: ${email || 'не найден'}`);

        return { site, phone, email };

    } catch (error) {
        console.error(`Ошибка при парсинге компании ${companyUrl}:`, error.message);
        return { site: '', phone: '', email: '' };
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
        'agravia.org',
        'catalog.agravia.org',
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
        const buffer = iconv.encode(data, 'win1251');
        fs.writeFileSync(filename, buffer);
        console.log(`💾 Файл сохранен: ${filename} (кодировка: Windows-1251)`);
    } catch (error) {
        console.warn(`⚠️ Не удалось сохранить в Windows-1251, сохраняем в UTF-8`);
        fs.writeFileSync(filename, data, 'utf8');
    }
}

// Запускаем парсинг
parseAgraviaExhibition();