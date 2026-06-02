const axios = require('axios');
const fs = require('fs');
const iconv = require('iconv-lite');

// НАСТРОЙКИ
const API_URL = 'https://personal-account.expovr.ru/api/exhibitors/search';
const OUTPUT_FILENAME = 'expovr-companies.csv';
const USE_ANSI_ENCODING = true;

// Параметры запроса
const BASE_PARAMS = {
    find: '',
    skip: 0,
    limit: 208, // Максимальное количество на страницу
    event: '696e2ce91684231f4b641f22',
    dates: '',
    categories: '',
    countries: '',
    lang: 'ru',
    where: 'index'
};

async function parseCompanies() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 ПАРСЕР: EXPOVR API');
        console.log('='.repeat(60));
        console.log(`🌐 API URL: ${API_URL}`);
        console.log(`📁 Файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(60) + '\n');

        // Получаем общее количество компаний
        const firstResponse = await axios.get(API_URL, {
            params: { ...BASE_PARAMS, limit: 1 }
        });
        
        const totalCompanies = firstResponse.data.total;
        console.log(`📊 Всего компаний: ${totalCompanies}`);
        
        if (totalCompanies === 0) {
            console.log('❌ Компании не найдены');
            return;
        }

        // Подготовка CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
        let processedCount = 0;
        let errorCount = 0;
        
        // Пагинация
        let skip = 0;
        const limit = BASE_PARAMS.limit;
        
        while (skip < totalCompanies) {
            console.log(`\n📄 Загружаем компании: ${skip + 1} - ${Math.min(skip + limit, totalCompanies)} из ${totalCompanies}`);
            
            try {
                const response = await axios.get(API_URL, {
                    params: { ...BASE_PARAMS, skip: skip, limit: limit },
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                
                const exhibitors = response.data.exhibitors || [];
                console.log(`   Получено компаний: ${exhibitors.length}`);
                
                for (const exhibitor of exhibitors) {
                    try {
                        // Название компании
                        const name = exhibitor.name?.ru || exhibitor.name?.en || '';
                        
                        // Ссылка на страницу компании (если есть)
                        let companyUrl = '';
                        if (exhibitor.event?.catalog_url?.ru) {
                            companyUrl = `${exhibitor.event.catalog_url.ru}?exhibitor=${exhibitor._id}`;
                        }
                        
                        // Контакты
                        const contacts = exhibitor.contacts || {};
                        const site = contacts.www || '';
                        const phone = contacts.phone || '';
                        const email = contacts.email || '';
                        
                        // Страна - берем как есть (код страны)
                        const country = contacts.country || '';
                        
                        // Очищаем данные
                        const cleanName = cleanText(name);
                        const cleanSite = cleanText(site);
                        const cleanPhone = cleanText(phone);
                        const cleanEmail = cleanText(email);
                        const cleanCountry = cleanText(country);
                        const cleanUrl = cleanText(companyUrl);
                        
                        // Добавляем в CSV
                        csvData += `"${cleanUrl}";"${cleanName}";"${cleanSite}";"${cleanPhone}";"${cleanEmail}";"${cleanCountry}"\n`;
                        
                        processedCount++;
                        
                        // Логируем каждую 10-ю компанию
                        if (processedCount % 10 === 0) {
                            console.log(`   ✅ Обработано: ${processedCount} компаний`);
                        }
                        
                    } catch (itemError) {
                        console.error(`   ❌ Ошибка обработки компании: ${itemError.message}`);
                        errorCount++;
                    }
                }
                
                skip += limit;
                
                // Небольшая задержка между запросами
                await delay(500);
                
            } catch (pageError) {
                console.error(`   ❌ Ошибка загрузки страницы: ${pageError.message}`);
                errorCount++;
                skip += limit;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        
        // Статистика
        console.log('\n' + '='.repeat(60));
        console.log('📊 СТАТИСТИКА:');
        console.log('='.repeat(60));
        console.log(`✅ Обработано компаний: ${processedCount}`);
        console.log(`❌ Ошибок: ${errorCount}`);
        console.log(`📊 Всего компаний: ${totalCompanies}`);
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

// Запускаем парсинг
parseCompanies();