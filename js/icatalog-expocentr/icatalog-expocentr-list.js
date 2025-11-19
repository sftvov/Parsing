const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// Параметры
const page = 'de590dc1-417d-11ee-80ce-a0d3c1fab97f';
const MAIN_URL = `https://icatalog.expocentr.ru/ru/exhibitions/${page}/list`;
const OUTPUT_FILENAME = `icatalog-expocentr_${page}.csv`;
const USE_ANSI_ENCODING = true;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг...');
        console.log(`Основная страница: ${MAIN_URL}`);
        
        // Получаем главную страницу со списком компаний
        const mainPageResponse = await axios.get(MAIN_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const mainDom = new JSDOM(mainPageResponse.data);
        
        // Находим все строки таблицы с компаниями
        const companyRows = mainDom.window.document.querySelectorAll('table tbody tr');
        console.log(`Найдено компаний: ${companyRows.length}`);
        
        if (companyRows.length === 0) {
            console.log('Не найдено компаний. Проверьте структуру страницы.');
            return;
        }
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую компанию
        for (let i = 0; i < companyRows.length; i++) {
            const row = companyRows[i];
            
            try {
                // Ищем ссылку на карточку компании в первом столбце
                const linkElement = row.querySelector('td:first-child a');
                if (!linkElement) {
                    console.log(`Пропускаем строку ${i + 1} - нет ссылки`);
                    continue;
                }
                
                const companyUrl = linkElement.href;
                const companyName = linkElement.textContent.trim();
                
                console.log(`\nОбрабатываем [${i + 1}/${companyRows.length}]: ${companyName}`);
                console.log(`URL: ${companyUrl}`);
                
                // Переходим на страницу компании
                const companyResponse = await axios.get(companyUrl, { 
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                const companyDom = new JSDOM(companyResponse.data);
                const companyDocument = companyDom.window.document;
                
                let site = '';
                let email = '';
                let phone = '';
                
                // Ищем все dt элементы в блоке с информацией
                const dtElements = companyDocument.querySelectorAll('dl.dl-horizontal dt');
                
                for (const dt of dtElements) {
                    const dtText = dt.textContent.trim();
                    const dd = dt.nextElementSibling;
                    
                    if (dd && dd.tagName === 'DD') {
                        const ddText = dd.textContent.trim();
                        
                        if (dtText.includes('Телефон') || dtText.includes('Phone')) {
                            phone = ddText;
                        } else if (dtText.includes('Сайт') || dtText.includes('Website')) {
                            // Извлекаем ссылку если есть
                            const link = dd.querySelector('a');
                            site = link ? link.href : ddText;
                        } else if (dtText.includes('E-mail') || dtText.includes('Email')) {
                            // Извлекаем email из ссылки mailto
                            const emailLink = dd.querySelector('a[href^="mailto:"]');
                            email = emailLink ? emailLink.href.replace('mailto:', '') : ddText;
                        }
                    }
                }
                
                // Альтернативный поиск, если через dt/dd не нашли
                if (!site) {
                    const siteLinks = companyDocument.querySelectorAll('a[href^="http"]');
                    for (const link of siteLinks) {
                        const href = link.href;
                        if (href && !href.includes('expocentr.ru') && !href.includes('mailto:')) {
                            site = href;
                            break;
                        }
                    }
                }
                
                if (!email) {
                    const emailLinks = companyDocument.querySelectorAll('a[href^="mailto:"]');
                    if (emailLinks.length > 0) {
                        email = emailLinks[0].href.replace('mailto:', '');
                    }
                }
                
                // Очищаем и форматируем данные
                const cleanName = companyName.replace(/"/g, '""').trim();
                const cleanSite = (site || '').replace(/"/g, '""').trim();
                const cleanPhone = (phone || '').replace(/"/g, '""').trim();
                const cleanEmail = (email || '').replace(/"/g, '""').trim();
                
                // Добавляем данные в CSV
                csvData += `"${companyUrl}";"${cleanName}";"${cleanSite}";"${cleanPhone}";"${cleanEmail}"\n`;
                
                // Выводим отладочную информацию
                console.log(`  Найдено: Сайт: ${cleanSite || 'нет'}, Телефон: ${cleanPhone || 'нет'}, Email: ${cleanEmail || 'нет'}`);
                
                // Небольшая задержка между запросами
                await delay(2000);
                
            } catch (error) {
                console.error(`Ошибка при обработке строки ${i + 1}:`, error.message);
                // Добавляем строку с ошибкой
                const linkElement = row.querySelector('td:first-child a');
                const companyName = linkElement ? linkElement.textContent.trim() : `Компания ${i + 1}`;
                const companyUrl = linkElement ? linkElement.href : '';
                csvData += `"${companyUrl}";"${companyName.replace(/"/g, '""')}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`\nДанные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла ошибка:', error.message);
        console.error('Stack:', error.stack);
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
            // Добавляем BOM для правильного отображения кириллицы в Excel
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