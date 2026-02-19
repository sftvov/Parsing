const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const iconv = require('iconv-lite');

// НАСТРОЙКИ
// Используем URL без лишнего пробела в конце
const BASE_URL = 'https://forvisitors.skrepkaexpo.ru/expositions/exposition/6164-skrepka-expo-2026.html';
const OUTPUT_FILENAME = 'skrepkaexpo.csv';
const COMPANIES_PER_PAGE = 48;

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

async function parseExhibition() {
    try {
        console.log(`🚀 Начинаем парсинг выставки СКРЕПКА ЭКСПО 2026...`);
        console.log(`🌐 Основная страница: ${BASE_URL}\n`);

        const allCompanies = await getAllCompanies();
        console.log(`✅ Всего найдено компаний: ${allCompanies.length}\n`);

        if (allCompanies.length === 0) {
            console.log('❌ Компании не найдены. Возможно, структура сайта изменилась или требуется принять cookies.');
            return;
        }

        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';

        for (let i = 0; i < allCompanies.length; i++) {
            const company = allCompanies[i];
            console.log(`📄 [${i + 1}/${allCompanies.length}]: ${company.name}`);
            console.log(`   Ссылка: ${company.url}`);

            try {
                const contacts = await parseCompanyContacts(company.url);
                csvData += `"${company.url}";"${company.name}";"${contacts.site}";"${contacts.phone}";"${contacts.email}"\n`;
                console.log(`   ✅ Найдено: Сайт: ${contacts.site || 'нет'}, Телефон: ${contacts.phone || 'нет'}, Email: ${contacts.email || 'нет'}`);
                await delay(1000 + Math.random() * 500);
            } catch (error) {
                console.error(`   ❌ Ошибка: ${error.message}`);
                csvData += `"${company.url}";"${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
            console.log();
        }

        saveToCSV(csvData, OUTPUT_FILENAME);
        console.log(`\n🎉 Данные сохранены в: ${OUTPUT_FILENAME}`);

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    }
}

async function getAllCompanies() {
    const allCompanies = [];
    let start = 0;
    let pageNumber = 1;
    let hasMorePages = true;

    console.log('🔍 Собираем список компаний...');

    while (hasMorePages && pageNumber <= 20) {
        try {
            const pageUrl = start === 0 ? BASE_URL : `${BASE_URL}?start=${start}`;
            console.log(`   Страница ${pageNumber}: ${pageUrl}`);

            const response = await axios.get(pageUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });

            const dom = new JSDOM(response.data);
            const document = dom.window.document;
            const companies = [];

            const companyElements = document.querySelectorAll('#scroll_list .scroll_item a');

            for (const element of companyElements) {
                try {
                    const companyUrl = element.getAttribute('href');
                    const companyName = element.getAttribute('title'); // Используем атрибут title

                    if (companyUrl && companyName) {
                        const fullUrl = companyUrl.startsWith('http')
                            ? companyUrl
                            : `https://forvisitors.skrepkaexpo.ru${companyUrl.startsWith('/') ? companyUrl : '/' + companyUrl}`;

                        // Фильтруем только ссылки на компании
                        if (fullUrl.includes('/company/') || fullUrl.includes('view=company')) {
                            companies.push({
                                name: cleanText(companyName),
                                url: fullUrl
                            });
                        }
                    }
                } catch (error) {
                    console.error('   Ошибка при обработке элемента:', error.message);
                }
            }

            console.log(`   Найдено на странице: ${companies.length} компаний`);
            allCompanies.push(...companies);

            if (companies.length < COMPANIES_PER_PAGE) {
                hasMorePages = false;
                console.log('   Это последняя страница');
            } else {
                start += COMPANIES_PER_PAGE;
                pageNumber++;
            }

            await delay(1500);

        } catch (error) {
            console.error(`   Ошибка при получении страницы ${pageNumber}:`, error.message);
            hasMorePages = false;
        }
    }

    return allCompanies;
}

async function parseCompanyContacts(companyUrl) {
    try {
        const response = await axios.get(companyUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        let site = '', phone = '', email = '';

        const contactsBlock = document.querySelector('#tab_contacts_flat');

        if (contactsBlock) {
            const blockText = contactsBlock.textContent;

            const siteMatch = blockText.match(/Сайт:?\s*([^\n<]+)/i);
            if (siteMatch) {
                const urlMatch = siteMatch[1].match(URL_REGEX);
                site = urlMatch ? cleanWebsite(urlMatch[0]) : cleanWebsite(siteMatch[1].trim());
            }

            const phoneMatch = blockText.match(/Телефон:?\s*([^\n<]+)/i);
            if (phoneMatch) {
                const phoneNumberMatch = phoneMatch[1].match(PHONE_REGEX);
                phone = phoneNumberMatch ? cleanPhone(phoneNumberMatch[0]) : cleanPhone(phoneMatch[1].trim());
            }

            const emailMatch = blockText.match(/E?-?mail:?\s*([^\n<]+)/i);
            if (emailMatch) {
                const emailFound = emailMatch[1].match(EMAIL_REGEX);
                email = emailFound ? emailFound[0] : '';
            }

            if (!email) {
                const allEmails = blockText.match(EMAIL_REGEX);
                email = (allEmails && allEmails.length > 0) ? allEmails[0] : '';
            }
            if (!phone) {
                const allPhones = blockText.match(PHONE_REGEX);
                phone = (allPhones && allPhones.length > 0) ? cleanPhone(allPhones[0]) : '';
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
            const pageText = document.body.textContent;

            const allEmails = pageText.match(EMAIL_REGEX);
            email = (allEmails && allEmails.length > 0) ? allEmails[0] : '';

            const allPhones = pageText.match(PHONE_REGEX);
            phone = (allPhones && allPhones.length > 0) ? cleanPhone(allPhones[0]) : '';

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

function cleanWebsite(url) {
    if (!url) return '';
    url = url.trim().replace(/^[^\w]*|[^\w]*$/g, '').split('?')[0].split('#')[0];
    return url && !url.startsWith('http') ? 'https://' + url : url;
}

function isValidWebsite(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    const excluded = ['forvisitors.skrepkaexpo.ru', 'catalog.', 'mailto:', 'tel:', 'javascript:', 'facebook.com', 'vk.com'];
    return !(lowerUrl.length <= 4 || !lowerUrl.includes('.') || excluded.some(domain => lowerUrl.includes(domain)));
}

function cleanPhone(phone) {
    return phone ? phone.replace(/\s+/g, ' ').trim() : '';
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToCSV(data, filename) {
    try {
        const buffer = iconv.encode(data, 'win1251');
        fs.writeFileSync(filename, buffer);
    } catch (error) {
        fs.writeFileSync(filename, data, 'utf8');
    }
}

// Запуск парсера
parseExhibition();