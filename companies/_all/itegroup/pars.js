const puppeteer = require('puppeteer');
const fs = require('fs');
const iconv = require('iconv-lite');

// НАСТРОЙКИ
const INPUT_JSON = 'itegroup_company_links.json';
const OUTPUT_CSV = 'itegroup2026_companies.csv';
const USE_ANSI_ENCODING = true;
const DELAY_BETWEEN_COMPANIES = 2000; // 2 секунды между запросами
const MAX_COMPANIES = 0; // 0 - все компании, или укажите число для теста

// Функция для парсинга одной страницы компании
async function parseCompanyPage(page, companyUrl, companyTitle) {
    try {
        console.log(`   🔍 Переходим на страницу: ${companyUrl}`);
        
        // Переходим на страницу компании
        await page.goto(companyUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Ждем загрузки контента
        await page.waitForSelector('.company-details', { timeout: 10000 }).catch(() => {});
        
        // Извлекаем данные
        const companyData = await page.evaluate(() => {
            // 1. Сайт (строго из i.fa-globe + a)
            let site = '';
            const globeIcon = document.querySelector('.company-info i.fa-globe');
            if (globeIcon) {
                // Ищем ссылку сразу после иконки
                const nextElement = globeIcon.parentElement?.nextElementSibling;
                if (nextElement && nextElement.tagName === 'A' && nextElement.href) {
                    site = nextElement.href;
                } else {
                    // Ищем в родительском блоке
                    const parent = globeIcon.closest('.company-info');
                    const linkElement = parent ? parent.querySelector('a[href]') : null;
                    if (linkElement && linkElement.href) {
                        site = linkElement.href;
                    }
                }
            }
            
            // 2. Категории (строго из .cat-table)
            let categories = '';
            const catTable = document.querySelector('.company-details .cat-table');
            if (catTable) {
                categories = catTable.textContent.trim().replace(/\s+/g, ' ').replace(/\|/g, ' | ');
            }
            
            return { site, categories };
        });
        
        return {
            url: companyUrl,
            title: companyTitle,
            site: companyData.site,
            categories: companyData.categories
        };
        
    } catch (error) {
        console.error(`   ❌ Ошибка парсинга страницы ${companyUrl}:`, error.message);
        return {
            url: companyUrl,
            title: companyTitle,
            site: 'ОШИБКА',
            categories: 'ОШИБКА'
        };
    }
}

// Основная функция
async function parseCompanies() {
    console.log('='.repeat(70));
    console.log('🚀 ПАРСЕР КОМПАНИЙ: TransRussia 2026');
    console.log('='.repeat(70));
    console.log(`📂 Входной файл: ${INPUT_JSON}`);
    console.log(`📁 Выходной файл: ${OUTPUT_CSV}`);
    console.log(`⏱️  Задержка между компаниями: ${DELAY_BETWEEN_COMPANIES}мс`);
    console.log(`🔢 Лимит компаний: ${MAX_COMPANIES > 0 ? MAX_COMPANIES : 'все'}`);
    console.log('='.repeat(70) + '\n');
    
    let browser = null;
    
    try {
        // Загружаем ссылки из JSON
        let companies = [];
        try {
            const jsonData = fs.readFileSync(INPUT_JSON, 'utf8');
            companies = JSON.parse(jsonData);
            console.log(`✅ Загружено ${companies.length} компаний из JSON\n`);
        } catch (error) {
            console.error(`❌ Ошибка загрузки JSON:`, error.message);
            return;
        }
        
        // Применяем лимит если нужно
        if (MAX_COMPANIES > 0 && companies.length > MAX_COMPANIES) {
            companies = companies.slice(0, MAX_COMPANIES);
            console.log(`🔢 Обрабатываем только ${MAX_COMPANIES} компаний\n`);
        }
        
        // Запускаем браузер
        browser = await puppeteer.launch({
            headless: false, // Видимый режим, чтобы видеть процесс
            defaultViewport: { width: 1280, height: 800 }
        });
        
        const page = await browser.newPage();
        
        // Подготовка CSV
        let csvData = 'Ссылка;Название;Сайт;Категории\n';
        let successCount = 0;
        let errorCount = 0;
        let siteFound = 0;
        let categoriesFound = 0;
        
        // Обрабатываем каждую компанию
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            
            console.log(`\n📄 Компания [${i + 1}/${companies.length}]: ${company.title}`);
            
            const result = await parseCompanyPage(page, company.url, company.title);
            
            // Добавляем в CSV
            csvData += `"${result.url}";"${result.title}";"${result.site}";"${result.categories}"\n`;
            
            // Выводим результат
            if (result.site && result.site !== 'ОШИБКА') {
                console.log(`   🌐 Сайт: ${result.site}`);
                siteFound++;
            } else {
                console.log(`   🌐 Сайт: не найден`);
            }
            
            if (result.categories && result.categories !== 'ОШИБКА') {
                const preview = result.categories.length > 70 
                    ? result.categories.substring(0, 70) + '...' 
                    : result.categories;
                console.log(`   📋 Категории: ${preview}`);
                categoriesFound++;
            } else {
                console.log(`   📋 Категории: не найдены`);
            }
            
            if (result.site === 'ОШИБКА' || result.categories === 'ОШИБКА') {
                errorCount++;
            } else {
                successCount++;
            }
            
            // Сохраняем промежуточные результаты каждые 10 компаний
            if ((i + 1) % 10 === 0) {
                saveToCSV(csvData, OUTPUT_CSV);
                console.log(`\n💾 Промежуточное сохранение после ${i + 1} компаний`);
            }
            
            // Задержка между запросами
            if (i < companies.length - 1) {
                console.log(`   ⏱️  Ожидание ${DELAY_BETWEEN_COMPANIES}мс...`);
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_COMPANIES));
            }
        }
        
        // Финальное сохранение
        saveToCSV(csvData, OUTPUT_CSV);
        
        // Статистика
        console.log('\n' + '='.repeat(70));
        console.log('📊 СТАТИСТИКА:');
        console.log('='.repeat(70));
        console.log(`📊 Всего компаний: ${companies.length}`);
        console.log(`✅ Успешно обработано: ${successCount}`);
        console.log(`❌ С ошибками: ${errorCount}`);
        console.log('─'.repeat(70));
        console.log(`🌐 Найдено сайтов: ${siteFound} (${Math.round(siteFound/companies.length*100)}%)`);
        console.log(`📋 Найдено категорий: ${categoriesFound} (${Math.round(categoriesFound/companies.length*100)}%)`);
        console.log('─'.repeat(70));
        console.log(`📁 Файл: ${OUTPUT_CSV}`);
        console.log('='.repeat(70));
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    } finally {
        if (browser) {
            console.log('\n🔄 Закрываем браузер...');
            await browser.close();
        }
        console.log('✅ Программа завершена');
    }
}

// Сохранение в CSV
function saveToCSV(data, filename) {
    try {
        if (USE_ANSI_ENCODING) {
            const iconv = require('iconv-lite');
            const buffer = iconv.encode(data, 'win1251');
            fs.writeFileSync(filename, buffer);
            console.log(`💾 Файл сохранен в кодировке Windows-1251`);
        } else {
            fs.writeFileSync(filename, data, 'utf8');
            console.log(`💾 Файл сохранен в кодировке UTF-8`);
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения файла:', error.message);
        // Пробуем сохранить в UTF-8 как запасной вариант
        fs.writeFileSync(filename, data, 'utf8');
        console.log(`💾 Файл сохранен в кодировке UTF-8 (запасной вариант)`);
    }
}

// Запуск
parseCompanies();