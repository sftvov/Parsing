const axios = require('axios');
const fs = require('fs');

// НАСТРОЙКИ
const API_URL = 'https://pirexpo.com/api/v3/brand/list?format=json&participation_theme=%0A++49%2C%0A++54%2C%0A++51';
const OUTPUT_FILENAME = 'pirexpo-companies.csv';
const USE_ANSI_ENCODING = true;

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг компаний Pirexpo...');
        
        // Получаем данные из API
        const response = await axios.get(API_URL, { 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const companies = response.data;
        console.log(`Всего компаний для обработки: ${companies.length}`);

        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую компанию
        for (let i = 0; i < companies.length; i++) {
            const company = companies[i];
            
            console.log(`Обрабатываем компанию [${i + 1}/${companies.length}]: ${company.name}`);
            
            try {
                // Формируем ссылку на детальную страницу компании
                const companyDetailUrl = `https://pirexpo.com/api/v3/brand/${company.id}?format=api`;
                
                // Извлекаем данные из JSON
                const name = company.name || '';
                const email = company.email || '';
                const site = company.website || '';
                const phone = company.phone || '';
                
                // Добавляем данные в CSV
                csvData += `"${companyDetailUrl}";"${name}";"${site}";"${phone}";"${email}"\n`;
                
                console.log(`  Найдено: ${name}`);
                console.log(`  Сайт: ${site || 'нет'}`);
                console.log(`  Телефон: ${phone || 'нет'}`);
                console.log(`  Email: ${email || 'нет'}`);
                
                // Небольшая задержка между обработкой компаний
                await delay(500);
                
            } catch (error) {
                console.error(`Ошибка при обработке компании ${company.name}:`, error.message);
                // Добавляем строку с ошибкой
                const companyDetailUrl = `https://pirexpo.com/api/v3/brand/${company.id}?format=api`;
                csvData += `"${companyDetailUrl}";"ОШИБКА: ${company.name}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла общая ошибка:', error.message);
    }
}

// Вспомогательные функции
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToFile(data, filename) {
    if (USE_ANSI_ENCODING) {
        const iconv = require('iconv-lite');
        const buffer = iconv.encode(data, 'win1251');
        fs.writeFileSync(filename, buffer);
    } else {
        fs.writeFileSync(filename, data, 'utf8');
    }
}

// Запускаем парсинг
parseCompanies();