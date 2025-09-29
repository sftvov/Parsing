const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// Параметры
const urlParams = {
    hallid: '49',
};

const page = 'b67ac0af-40d1-11ee-80ce-a0d3c1fab97f';

// Базовый URL без параметров
const baseUrl = 'https://icatalog.expocentr.ru/ru/exhibitions/' + page;

// Формируем полный URL
function buildApiUrl(baseUrl, params) {
    const queryParams = new URLSearchParams(params).toString();
    return `${baseUrl}?${queryParams}`;
}

const MAIN_URL = buildApiUrl(baseUrl, urlParams);
const OUTPUT_FILENAME = `icatalog-expocentr_${page}_${urlParams.hallid}.csv`;
const USE_ANSI_ENCODING = true;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг...');
        console.log(`Основная страница: ${MAIN_URL}`);
        
        // Получаем главную страницу со ссылками
        const mainPageResponse = await axios.get(MAIN_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const mainDom = new JSDOM(mainPageResponse.data);
        
        // Находим все ссылки на компании по классу list-group-item
        const companyLinks = mainDom.window.document.querySelectorAll('a.list-group-item');
        console.log(`Найдено ссылок: ${companyLinks.length}`);
        
        if (companyLinks.length === 0) {
            console.log('Не найдено ссылок на компании. Проверьте селектор.');
            return;
        }
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую ссылку (ограничиваем 3 для теста)
        for (let i = 0; i < companyLinks.length; i++) {
            const linkElement = companyLinks[i];
            const companyUrl = linkElement.href;
            
            // Получаем только непосредственный текст ссылки
            const companyName = Array.from(linkElement.childNodes)
                .filter(node => node.nodeType === node.TEXT_NODE)
                .map(node => node.textContent.trim())
                .join(' ')
                .trim();
            
            console.log(`\nОбрабатываем [${i + 1}/${companyLinks.length}]: ${companyName}`);
            console.log(`URL: ${companyUrl}`);
            
            try {
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
                
                // Ищем все dt элементы
                const dtElements = companyDocument.querySelectorAll('dt');
                
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
                            email = ddText;
                        }
                    }
                }
                
                // Альтернативный поиск, если через dt/dd не нашли
                if (!site || !email || !phone) {
                    // Поиск по классам или другим селекторам
                    const siteElement = companyDocument.querySelector('a[href*="http"]');
                    if (siteElement && !site) {
                        site = siteElement.href;
                    }
                    
                    const emailElements = companyDocument.querySelectorAll('a[href^="mailto:"]');
                    if (emailElements.length > 0 && !email) {
                        email = emailElements[0].href.replace('mailto:', '');
                    }
                }
                
                // Добавляем данные в CSV
                csvData += `"${companyUrl}";"${companyName.replace(/"/g, '""')}";"${site.replace(/"/g, '""')}";"${phone.replace(/"/g, '""')}";"${email.replace(/"/g, '""')}"\n`;
                
                // Выводим отладочную информацию
                console.log(`  Найдено: Сайт: ${site || 'нет'}, Телефон: ${phone || 'нет'}, Email: ${email || 'нет'}`);
                
                // Небольшая задержка между запросами
                await delay(2000);
                
            } catch (error) {
                console.error(`Ошибка при обработке ${companyUrl}:`, error.message);
                // Добавляем строку с ошибкой
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