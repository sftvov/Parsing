const axios = require('axios');
const fs = require('fs');
const iconv = require('iconv-lite');

// НАСТРОЙКИ
const EXHIBITION_ID = 4;
const LIST_URL = `https://forms.agrosalon.ru/api/exhibitors?exhibitionId=${EXHIBITION_ID}`;
const DETAIL_URL = 'https://forms.agrosalon.ru/api/exhibitors/detail?catalogId=';
const OUTPUT_FILENAME = 'agrosalon_exhibitors.csv';
const USE_ANSI_ENCODING = true;
const DELAY_BETWEEN_REQUESTS = 300; // мс
const MAX_COMPANIES = 0; // 0 = все, или ограничьте число для теста

// Общие заголовки (обязательны для обхода 500)
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
    'Origin': 'https://www.agrosalon.ru',
    'Referer': 'https://www.agrosalon.ru/',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
};

async function parseAgrosalon() {
    try {
        console.log('='.repeat(70));
        console.log('🚀 ПАРСЕР: AGROSALON — ПОЛНАЯ ВЫГРУЗКА');
        console.log('='.repeat(70));
        console.log(`🌐 API списка: ${LIST_URL}`);
        console.log(`🌐 API деталей: ${DETAIL_URL}{catalogId}`);
        console.log(`📁 Файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(70) + '\n');

        // 1. Получаем общую выгрузку
        console.log('📡 Шаг 1: Получаем список компаний...');
        const listResponse = await axios.get(LIST_URL, {
            timeout: 30000,
            headers: HEADERS
        });

        const companies = listResponse.data.companies || [];
        console.log(`✅ Получено компаний: ${companies.length}\n`);

        if (companies.length === 0) {
            console.log('❌ Компании не найдены');
            return;
        }

        // 2. Извлекаем только ID
        let ids = companies.map(c => c.id).filter(Boolean);
        if (MAX_COMPANIES > 0) {
            ids = ids.slice(0, MAX_COMPANIES);
            console.log(`🔢 Ограничение: обрабатываем первые ${MAX_COMPANIES} компаний\n`);
        }

        console.log(`📋 ID для обработки: ${ids.length}\n`);

        // 3. Подготовка CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
        let stats = { success: 0, errors: 0, site: 0, phone: 0, email: 0, country: 0 };

        // 4. Обрабатываем каждую компанию
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const detailUrl = `${DETAIL_URL}${id}`;

            try {
                const detailResponse = await axios.get(detailUrl, {
                    timeout: 15000,
                    headers: HEADERS
                });

                const d = detailResponse.data;

                // Извлекаем поля
                const title = d.company || d.company_eng || 'Без названия';
                const url = d.url || ''; // в детальном API нет поля url, оставим пустым
                
                // Контакты — первый элемент массива contacts
                const contacts = Array.isArray(d.contacts) && d.contacts.length > 0 ? d.contacts[0] : {};
                const site = cleanContact(contacts.site);
                const phone = cleanContact(contacts.phone);
                const email = cleanContact(contacts.email);
                
                // Страна — первый элемент массива countries
                const country = Array.isArray(d.countries) && d.countries.length > 0 
                    ? d.countries[0].name 
                    : '';

                // Статистика
                if (site) stats.site++;
                if (phone) stats.phone++;
                if (email) stats.email++;
                if (country) stats.country++;

                // Добавляем в CSV
                csvData += `"${url}";"${cleanText(title)}";"${site}";"${phone}";"${email}";"${cleanText(country)}"\n`;

                stats.success++;

                if (i < 10 || (i + 1) % 50 === 0) {
                    console.log(`📄 [${i + 1}/${ids.length}] ${title}`);
                    console.log(`   🌐 Сайт: ${site || 'нет'}`);
                    console.log(`   📞 Телефон: ${phone || 'нет'}`);
                    console.log(`   ✉️ Email: ${email || 'нет'}`);
                    console.log(`   🌍 Страна: ${country || 'нет'}`);
                } else {
                    process.stdout.write(`\r📄 [${i + 1}/${ids.length}] ${title.substring(0, 50)}...`);
                }

                await delay(DELAY_BETWEEN_REQUESTS);

            } catch (error) {
                console.error(`\n❌ Ошибка при обработке ID ${id}: ${error.message}`);
                stats.errors++;
                csvData += `"";"ОШИБКА ID ${id}";"ОШИБКА";"ОШИБКА";"ОШИБКА";""\n`;
            }
        }

        console.log('\n');

        // 5. Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);

        // 6. Итоговая статистика
        console.log('\n' + '='.repeat(70));
        console.log('📊 ИТОГОВАЯ СТАТИСТИКА:');
        console.log('='.repeat(70));
        console.log(`📊 Всего ID: ${ids.length}`);
        console.log(`✅ Успешно: ${stats.success}`);
        console.log(`❌ Ошибок: ${stats.errors}`);
        console.log('─'.repeat(70));
        console.log(`🌐 Сайт: ${stats.site} (${Math.round(stats.site/ids.length*100)}%)`);
        console.log(`📞 Телефон: ${stats.phone} (${Math.round(stats.phone/ids.length*100)}%)`);
        console.log(`✉️ Email: ${stats.email} (${Math.round(stats.email/ids.length*100)}%)`);
        console.log(`🌍 Страна: ${stats.country} (${Math.round(stats.country/ids.length*100)}%)`);
        console.log(`💾 Файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(70));

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
        if (error.response) {
            console.error(`Статус: ${error.response.status}`);
        }
    }
}

// --- Очистка контактов от табов/пробелов в конце ---
function cleanContact(value) {
    if (!value || typeof value !== 'string') return '';
    return value.replace(/\t/g, '').trim().replace(/"/g, '""');
}

function cleanText(value) {
    if (!value) return '';
    return value.replace(/\s+/g, ' ').trim().replace(/"/g, '""');
}

// --- Сохранение в файл ---
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

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Запуск
parseAgrosalon();