const axios = require('axios');
const { JSDOM } = require('jsdom');
const fs = require('fs');
const iconv = require('iconv-lite');

// НАСТРОЙКИ
const MAIN_DOMEN = 'https://meatindustry.ru';
const MAIN_URL = MAIN_DOMEN + '/catalog/uchastniki-vystavki-2025/';
const OUTPUT_FILENAME = 'meatindustry_2025.csv';
const USE_ANSI_ENCODING = true;
const DELAY_BETWEEN_COMPANIES = 1500;

// Функция для парсинга списка компаний
async function parseCompanies() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 ПАРСЕР: Meat & Poultry Industry Russia');
        console.log('='.repeat(60));
        console.log(`🌐 Основная страница: ${MAIN_URL}`);
        console.log(`📁 Выходной файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(60) + '\n');

        // Получаем главную страницу
        console.log('🔍 Загружаем страницу со списком компаний...');
        const mainPageResponse = await axios.get(MAIN_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const mainDom = new JSDOM(mainPageResponse.data);
        const document = mainDom.window.document;

        // Находим все ссылки на компании
        const companyLinks = document.querySelectorAll('.catalog-table .catalog-table__info-title a');
        console.log(`🔍 Найдено компаний: ${companyLinks.length}\n`);

        if (companyLinks.length === 0) {
            console.log('❌ Компании не найдены. Проверьте селектор .catalog-table .catalog-table__info-title a');
            return;
        }

        // Подготовка CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
        let successCount = 0;
        let errorCount = 0;
        let foundStats = { site: 0, phone: 0, email: 0, country: 0 };

        // Обрабатываем каждую компанию
        for (let i = 0; i < companyLinks.length; i++) {
            const linkElement = companyLinks[i];
            const companyUrl = MAIN_DOMEN + linkElement.getAttribute('href');
            
            // Название из span внутри ссылки
            const nameSpan = linkElement.querySelector('span');
            const companyName = nameSpan ? nameSpan.textContent.trim() : linkElement.textContent.trim();

            console.log(`\n📄 Компания [${i + 1}/${companyLinks.length}]: ${companyName}`);
            console.log(`🔗 URL: ${companyUrl}`);

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
                let phone = '';
                let email = '';
                let country = '';

                // Ищем все блоки свойств компании
                const propertyBlocks = companyDocument.querySelectorAll('[itemprop="additionalProperty"]');
                console.log(`   🔍 Найдено блоков свойств: ${propertyBlocks.length}`);

                for (const block of propertyBlocks) {
                    // Ищем название свойства
                    const nameElement = block.querySelector('.char_name [itemprop="name"]');
                    const valueElement = block.querySelector('.char_value');

                    if (nameElement && valueElement) {
                        const propertyName = nameElement.textContent.trim().toLowerCase();
                        let propertyValue = valueElement.textContent.trim();

                        // Определяем тип свойства по названию
                        if (propertyName.includes('сайт') || propertyName.includes('site') || propertyName.includes('web')) {
                            site = propertyValue;
                            console.log(`   🌐 Сайт: ${site}`);
                        } 
                        else if (propertyName.includes('телефон') || propertyName.includes('phone') || propertyName.includes('tel')) {
                            phone = propertyValue;
                            console.log(`   📞 Телефон: ${phone}`);
                        }
                        else if (propertyName.includes('email') || propertyName.includes('e-mail') || propertyName.includes('почта')) {
                            email = propertyValue;
                            console.log(`   ✉️  Email: ${email}`);
                        }
                        else if (propertyName.includes('страна') || propertyName.includes('country')) {
                            country = propertyValue;
                            console.log(`   🌍 Страна: ${country}`);
                        }
                    }
                }

                // Очищаем данные для CSV
                const cleanName = cleanText(companyName);
                const cleanSite = cleanText(site);
                const cleanPhone = cleanText(phone);
                const cleanEmail = cleanText(email);
                const cleanCountry = cleanText(country);

                // Добавляем в CSV
                csvData += `"${companyUrl}";"${cleanName}";"${cleanSite}";"${cleanPhone}";"${cleanEmail}";"${cleanCountry}"\n`;

                // Статистика
                if (cleanSite) foundStats.site++;
                if (cleanPhone) foundStats.phone++;
                if (cleanEmail) foundStats.email++;
                if (cleanCountry) foundStats.country++;
                successCount++;

                // Задержка между запросами
                await delay(DELAY_BETWEEN_COMPANIES);

            } catch (error) {
                console.error(`   ❌ Ошибка при обработке: ${error.message}`);
                csvData += `"${companyUrl}";"${cleanText(companyName)}";"ОШИБКА";"ОШИБКА";"ОШИБКА";""\n`;
                errorCount++;
            }
        }

        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);

        // Статистика
        console.log('\n' + '='.repeat(60));
        console.log('📊 СТАТИСТИКА:');
        console.log('='.repeat(60));
        console.log(`📊 Всего компаний: ${companyLinks.length}`);
        console.log(`✅ Успешно обработано: ${successCount}`);
        console.log(`❌ С ошибками: ${errorCount}`);
        console.log('─'.repeat(60));
        console.log(`🌐 Найдено сайтов: ${foundStats.site}`);
        console.log(`📞 Найдено телефонов: ${foundStats.phone}`);
        console.log(`✉️  Найдено email: ${foundStats.email}`);
        console.log(`🌍 Найдено стран: ${foundStats.country}`);
        console.log(`💾 Файл: ${OUTPUT_FILENAME}`);
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
        if (USE_ANSI_ENCODING) {
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

// Запуск парсера
parseCompanies();