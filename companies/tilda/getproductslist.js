const axios = require('axios');
const fs = require('fs');
const iconv = require('iconv-lite');

// API URL
const API_URL = 'https://store.tildaapi.com/api/getproductslist/?storepartuid=686464424382&recid=514362613&c=1778362306937&getparts=true&getoptions=true&size=120&flag_root=withroot';
const OUTPUT_FILENAME = 'vodexpo_companies.csv';
const USE_ANSI_ENCODING = true;

// ИСПРАВЛЕННАЯ функция извлечения страны
function extractCountry(text) {
    // Ищем второе вхождение <span style="color: rgb(0, 0, 0);">
    const firstSpan = text.indexOf('<span style="color: rgb(0, 0, 0);">');
    if (firstSpan === -1) return '';
    
    const secondSpan = text.indexOf('<span style="color: rgb(0, 0, 0);">', firstSpan + 1);
    if (secondSpan === -1) return '';
    
    // Находим закрывающий тег
    const closingSpan = text.indexOf('</span>', secondSpan);
    if (closingSpan === -1) return '';
    
    // Извлекаем ВСЁ, что между > и <
    const startContent = secondSpan + 32; // длина <span style="color: rgb(0, 0, 0);"> = 32
    let country = text.substring(startContent, closingSpan);
    
    // Удаляем любые символы > ; " если они остались
    country = country.replace(/^[;>\"]+/, '').trim();
    
    return country;
}

// Точное извлечение сайта
function extractSite(text) {
    const start = text.indexOf('<a href="');
    if (start === -1) return '';
    
    const end = text.indexOf('"', start + 9);
    if (end === -1) return '';
    
    return text.substring(start + 9, end);
}

// Точное извлечение email
function extractEmail(text) {
    const start = text.indexOf('mailto:');
    if (start === -1) return '';
    
    const end = text.indexOf('"', start);
    if (end === -1) return '';
    
    return text.substring(start + 7, end);
}

// Точное извлечение телефона
function extractPhone(text) {
    const label = 'Телефон: ';
    const start = text.indexOf(label);
    if (start === -1) return '';
    
    const end = text.indexOf('<', start);
    if (end === -1) return '';
    
    return text.substring(start + label.length, end).trim();
}

async function parseCompanies() {
    try {
        console.log('='.repeat(60));
        console.log('🚀 ПАРСЕР: VODEXPO (TILDA API)');
        console.log('='.repeat(60));
        console.log(`🌐 API URL: ${API_URL}`);
        console.log(`📁 Выходной файл: ${OUTPUT_FILENAME}`);
        console.log('='.repeat(60) + '\n');

        // Отправляем запрос
        console.log('📡 Отправляем запрос к API...');
        const response = await axios.get(API_URL, {
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        // Компании лежат в поле 'products'
        const products = response.data.products;
        
        if (!products || !Array.isArray(products)) {
            console.error('❌ Ошибка: поле products не найдено или не является массивом');
            return;
        }
        
        console.log(`✅ Найдено компаний: ${products.length}\n`);

        // Подготовка CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
        let stats = { site: 0, phone: 0, email: 0, country: 0 };

        // Обрабатываем каждую компанию
        for (let i = 0; i < products.length; i++) {
            const product = products[i];
            const title = product.title || 'Без названия';
            const url = product.url || '';
            const text = product.text || '';
            
            // Точное извлечение
            const country = extractCountry(text);
            const site = extractSite(text);
            const email = extractEmail(text);
            const phone = extractPhone(text);
            
            // Статистика
            if (site) stats.site++;
            if (phone) stats.phone++;
            if (email) stats.email++;
            if (country) stats.country++;
            
            // CSV
            csvData += `"${url}";"${title}";"${site}";"${phone}";"${email}";"${country}"\n`;
            
            // Первые 10
            if (i < 10) {
                console.log(`📄 ${i+1}. ${title}`);
                console.log(`   🌍 Страна: ${country || 'не указана'}`);
                console.log(`   🌐 Сайт: ${site || 'нет'}`);
                console.log(`   📞 Телефон: ${phone || 'нет'}`);
                console.log(`   ✉️ Email: ${email || 'нет'}`);
                console.log('');
            }
        }
        
        if (products.length > 10) {
            console.log(`... и еще ${products.length - 10} компаний\n`);
        }

        // Сохраняем
        saveToFile(csvData, OUTPUT_FILENAME);

        // Статистика
        console.log('='.repeat(60));
        console.log('📊 СТАТИСТИКА:');
        console.log('='.repeat(60));
        console.log(`📊 Всего компаний: ${products.length}`);
        console.log(`🌍 Страна: ${stats.country} (${Math.round(stats.country/products.length*100)}%)`);
        console.log(`🌐 Сайт: ${stats.site} (${Math.round(stats.site/products.length*100)}%)`);
        console.log(`📞 Телефон: ${stats.phone} (${Math.round(stats.phone/products.length*100)}%)`);
        console.log(`✉️ Email: ${stats.email} (${Math.round(stats.email/products.length*100)}%)`);
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
        console.error('Ошибка при сохранении файла:', error.message);
        fs.writeFileSync(filename, data, 'utf8');
    }
}

// Запуск
parseCompanies();