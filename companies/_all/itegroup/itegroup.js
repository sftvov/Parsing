const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const iconv = require('iconv-lite');

// Базовый URL
const baseUrl = 'https://exhibitors-itegroup.exhibitoronlinemanual.com/ru/Exhibitor/ajaxPaginationData';

// НАСТРОЙКИ
const USE_ANSI_ENCODING = true; // true - ANSI (Windows-1251), false - UTF-8
const TOTAL_COMPANIES_TO_COLLECT = 197; // Сколько всего компаний нужно собрать

// Параметры запроса
const requestParams = {
    page: '0',
    keywords: '',
    keyword_search: '',
    country_id: '',
    event_prod_cat_id: '',
    exb_listed_as: '',
    sortBy: '',
    event_id: '6',
    InitialKey: '',
    ExhibitorDataView: '',
    certificationId: '',
    language: 'ru',
    sub_product: ''
};

// Формируем данные для POST запроса
function buildFormData(params) {
    const formData = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        formData.append(key, value);
    });
    return formData.toString();
}

// Функция для задержки между запросами
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Собираем все ссылки на компании
async function collectCompanyLinks() {
    const companies = [];
    let page = 0;
    let skip = 0;
    const limit = 24;

    console.log(`Собираем ссылки на компании (всего нужно: ${TOTAL_COMPANIES_TO_COLLECT})...`);

    while (companies.length < TOTAL_COMPANIES_TO_COLLECT) {
        try {
            console.log(`Загружаем страницу (skip: ${skip}, limit: ${limit})...`);
            
            const params = {
                ...requestParams,
                page: String(page),
                skip: String(skip),
                limit: String(limit)
            };

            const response = await axios({
                method: 'post',
                url: baseUrl,
                data: buildFormData(params),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Referer': 'https://exhibitors-itegroup.exhibitoronlinemanual.com/ru/Exhibitor'
                }
            });

            if (response.status !== 200) {
                throw new Error(`Ошибка HTTP: ${response.status}`);
            }

            // Парсим HTML
            const dom = new JSDOM(response.data);
            const document = dom.window.document;

            // Ищем компании по селектору .card-body .card-title a
            const companyLinks = document.querySelectorAll('.card-body .card-title a');
            
            if (companyLinks.length === 0) {
                console.log('Больше компаний не найдено, завершаем сбор...');
                break;
            }

            // Добавляем компании в массив
            companyLinks.forEach(link => {
                if (companies.length < TOTAL_COMPANIES_TO_COLLECT) {
                    const name = safeToString(link.textContent);
                    const href = safeToString(link.getAttribute('href'));
                    const fullUrl = href ? new URL(href, 'https://exhibitors-itegroup.exhibitoronlinemanual.com').href : '';

                    companies.push({
                        name: name,
                        url: fullUrl,
                        website: '' // Будем заполнять позже
                    });
                }
            });

            console.log(`Собрано компаний: ${companies.length}/${TOTAL_COMPANIES_TO_COLLECT}`);

            // Переходим к следующей странице
            page++;
            skip += limit;

            // Задержка между запросами
            await delay(1000);

        } catch (error) {
            console.error(`Ошибка при загрузке страницы: ${error.message}`);
            break;
        }
    }

    return companies;
}

// Парсим сайт компании из .company-info a
async function parseCompanyWebsite(companyUrl) {
    try {
        console.log(`Парсим сайт компании: ${companyUrl}`);
        
        const response = await axios({
            method: 'get',
            url: companyUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://exhibitors-itegroup.exhibitoronlinemanual.com/ru/Exhibitor'
            },
            timeout: 10000
        });

        if (response.status !== 200) {
            return '';
        }

        // Парсим HTML страницы компании
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        // Ищем сайт в .company-info a
        const websiteLink = document.querySelector('.company-info a');
        if (websiteLink) {
            const website = safeToString(websiteLink.getAttribute('href') || websiteLink.textContent);
            return website;
        }

        return '';

    } catch (error) {
        console.error(`Ошибка при парсинге сайта компании ${companyUrl}: ${error.message}`);
        return '';
    }
}

// Основная функция
async function parseExhibitors() {
    try {
        console.log('Начинаем сбор данных экспонентов...');
        console.log(`Кодировка: ${USE_ANSI_ENCODING ? 'ANSI (Windows-1251)' : 'UTF-8'}`);
        console.log(`Цель: собрать ${TOTAL_COMPANIES_TO_COLLECT} компаний\n`);

        // 1. Собираем все ссылки на компании
        const companies = await collectCompanyLinks();
        
        console.log(`\n✅ Сбор ссылок завершен! Всего собрано: ${companies.length} компаний`);
        console.log('Начинаем парсинг сайтов компаний...\n');

        // 2. Парсим сайты для каждой компании
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            console.log(`[${i + 1}/${companies.length}] ${company.name}`);
            
            if (company.url) {
                company.website = await parseCompanyWebsite(company.url);
                console.log(`   Сайт: ${company.website || 'не найден'}`);
            } else {
                console.log(`   ❌ Нет ссылки на компанию`);
            }
            
            // Задержка между запросами к сайтам компаний
            await delay(1500);
        }

        // 3. Подготавливаем CSV
        let csvData = 'Ссылка;Название;Сайт\n';
        
        companies.forEach(company => {
            // Экранируем для CSV
            const escapeCsv = (str) => {
                if (!str) return '';
                if (str.includes(';') || str.includes('"')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            csvData += `${escapeCsv(company.url)};${escapeCsv(company.name)};${escapeCsv(company.website)}\n`;
        });

        // 4. Сохраняем в файл
        const encodingSuffix = USE_ANSI_ENCODING ? '_ansi' : '_utf8';
        const filename = `exhibitors_companies${encodingSuffix}.csv`;
        
        if (USE_ANSI_ENCODING) {
            const csvBuffer = iconv.encode(csvData, 'win1251');
            fs.writeFileSync(filename, csvBuffer);
        } else {
            fs.writeFileSync(filename, '\uFEFF' + csvData, 'utf8');
        }
        
        console.log(`\n✅ Данные успешно сохранены в файл ${filename}`);
        console.log(`📊 Всего компаний: ${companies.length}`);
        console.log(`📏 Размер файла: ${Math.round(Buffer.byteLength(csvData) / 1024)} KB`);

        // Статистика по сайтам
        const withWebsite = companies.filter(c => c.website).length;
        console.log(`🌐 Компаний с сайтом: ${withWebsite}`);

    } catch (error) {
        console.error('Произошла ошибка:', error.message);
    }
}

// Безопасное преобразование в строку
function safeToString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value).trim();
}

// Запускаем парсинг
parseExhibitors();