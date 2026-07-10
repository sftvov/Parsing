const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const iconv = require('iconv-lite');

// НАСТРОЙКИ
const MAIN_URL = 'https://crane-expo.ru/list';
const OUTPUT_FILENAME = 'crane-expo.csv';
const USE_ANSI_ENCODING = true;
const DELAY_BETWEEN_REQUESTS = 2000;

// Функция для извлечения контактов из текста
function extractContactsFromText(text) {
    if (!text) return { site: '', phone: '', email: '', country: '' };
    
    let site = '';
    let phone = '';
    let email = '';
    let country = '';
    
    // Ищем сайт (URL)
    const siteMatch = text.match(/https?:\/\/[^\s<>\n]+/i);
    if (siteMatch) {
        site = siteMatch[0];
    }
    
    // Ищем email
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
    if (emailMatch) {
        email = emailMatch[0];
    }
    
    // Ищем телефон (разные форматы)
    const phonePatterns = [
        /Телефон:\s*([^\n<]+)/i,
        /Tel:\s*([^\n<]+)/i,
        /Тел:\s*([^\n<]+)/i,
        /\+7\s*\(\d{3}\)\s*\d{3}-\d{2}-\d{2}/,
        /\+7\s*\d{3}\s*\d{3}\s*\d{2}\s*\d{2}/,
        /8\s*800\s*\d{3}\s*\d{2}\s*\d{2}/,
        /\+86\s*\d{3}\s*\d{4}\s*\d{4}/,
        /\+90\s*\d{3}\s*\d{3}\s*\d{2}\s*\d{2}/
    ];
    
    for (const pattern of phonePatterns) {
        const match = text.match(pattern);
        if (match) {
            phone = match[0].replace(/Телефон:|Tel:|Тел:/i, '').trim();
            break;
        }
    }
    
    // Ищем страну (в скобках после названия)
    const countryMatch = text.match(/\(([А-ЯЁA-Z][а-яёa-z]+)\)/);
    if (countryMatch) {
        country = countryMatch[1];
    }
    
    return { site, phone, email, country };
}

async function parseCompanies() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 ПАРСЕР: CRANE EXPO');
        console.log('='.repeat(60));
        console.log(`🌐 Основная страница: ${MAIN_URL}`);
        console.log(`📁 Выходной файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(60) + '\n');

        // Получаем главную страницу
        console.log('🔍 Загружаем страницу...');
        const response = await axios.get(MAIN_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        // Находим все блоки .t1025__product-full
        const productBlocks = document.querySelectorAll('.t1025__product-full');
        console.log(`🔍 Найдено блоков: ${productBlocks.length}\n`);

        if (productBlocks.length === 0) {
            console.log('❌ Блоки .t1025__product-full не найдены. Проверьте структуру страницы.');
            return;
        }

        // Подготовка CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
        let stats = { total: 0, site: 0, phone: 0, email: 0, country: 0 };

        // Обрабатываем каждый блок
        for (let i = 0; i < productBlocks.length; i++) {
            const block = productBlocks[i];
            
            try {
                // 1. Получаем номер из data-product-lid
                const productLid = block.getAttribute('data-product-lid');
                if (!productLid) {
                    console.log(`⚠️ Пропускаем блок ${i+1} - нет data-product-lid`);
                    continue;
                }

                // 2. Формируем ссылку
                const companyUrl = `https://crane-expo.ru/list#!/tproduct/2189245111-${productLid}`;

                // 3. Ищем название
                const nameElement = block.querySelector('.js-product-name');
                const companyName = nameElement ? nameElement.textContent.trim() : 'Без названия';

                // 4. Ищем блок с описанием и контактами
                const descrBlock = block.querySelector('.t1025__descr');
                const description = descrBlock ? descrBlock.textContent.trim() : '';

                // 5. Извлекаем контакты из описания
                const contacts = extractContactsFromText(description);

                console.log(`\n📄 [${i + 1}/${productBlocks.length}] ${companyName}`);
                console.log(`   🔗 ${companyUrl}`);
                console.log(`   🌍 Страна: ${contacts.country || 'не найдена'}`);
                console.log(`   🌐 Сайт: ${contacts.site || 'не найден'}`);
                console.log(`   📞 Телефон: ${contacts.phone || 'не найден'}`);
                console.log(`   ✉️ Email: ${contacts.email || 'не найден'}`);

                // Обновляем статистику
                stats.total++;
                if (contacts.site) stats.site++;
                if (contacts.phone) stats.phone++;
                if (contacts.email) stats.email++;
                if (contacts.country) stats.country++;

                // Добавляем в CSV
                csvData += `"${companyUrl}";"${companyName}";"${contacts.site}";"${contacts.phone}";"${contacts.email}";"${contacts.country}"\n`;

            } catch (error) {
                console.error(`❌ Ошибка при обработке блока ${i + 1}:`, error.message);
            }
        }

        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);

        // Статистика
        console.log('\n' + '='.repeat(60));
        console.log('📊 СТАТИСТИКА:');
        console.log('='.repeat(60));
        console.log(`📊 Всего компаний: ${stats.total}`);
        console.log(`🌐 Найдено сайтов: ${stats.site} (${Math.round(stats.site/stats.total*100)}%)`);
        console.log(`📞 Найдено телефонов: ${stats.phone} (${Math.round(stats.phone/stats.total*100)}%)`);
        console.log(`✉️ Найдено email: ${stats.email} (${Math.round(stats.email/stats.total*100)}%)`);
        console.log(`🌍 Найдено стран: ${stats.country} (${Math.round(stats.country/stats.total*100)}%)`);
        console.log(`💾 Файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    }
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

// Запуск
parseCompanies();