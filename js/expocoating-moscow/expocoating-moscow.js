const axios = require('axios');
const fs = require('fs');

// НАСТРОЙКИ
const BASE_URL = 'https://www.expocoating-moscow.ru/ru-RU/about/exhibitor-list/exhibitorpopup.aspx?id=';
const OUTPUT_FILENAME = 'expocoating-companies.csv';
const USE_ANSI_ENCODING = true;

// МАССИВ ID КОМПАНИЙ
const COMPANY_IDS = [
    "112182", "111600", "111786", "111955", "112114", "111985", "111630", 
    "111556", "111432", "112049", "111784", "111804", "112146", "111367", 
    "111707", "111595", "112104", "111923", "111928", "111954", "111596", 
    "112007", "112014", "111974", "111779", "112236", "112312", "111576", 
    "111605", "111891", "111562", "111811", "111927", "112300", "111370", 
    "111783", "112072", "111579", "111925", "112226", "112229", "111792", 
    "111425"
];

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг компаний Expocoating...');
        console.log(`Всего компаний для обработки: ${COMPANY_IDS.length}`);
        
        // Подготовка данных для CSV
        let csvData = 'Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую компанию по ID
        for (let i = 0; i < COMPANY_IDS.length; i++) {
            const companyId = COMPANY_IDS[i];
            const companyUrl = `${BASE_URL}${companyId}`;
            
            console.log(`Обрабатываем компанию [${i + 1}/${COMPANY_IDS.length}]: ID ${companyId}`);
            
            try {
                const companyDetails = await parseCompanyDetails(companyUrl, companyId);
                
                // Добавляем данные в CSV
                csvData += `"${companyDetails.name}";"${companyDetails.site}";"${companyDetails.phone}";"${companyDetails.email}"\n`;
                
                console.log(`  Найдено: ${companyDetails.name}`);
                console.log(`  Сайт: ${companyDetails.site || 'нет'}`);
                console.log(`  Телефон: ${companyDetails.phone || 'нет'}`);
                console.log(`  Email: ${companyDetails.email || 'нет'}`);
                
                // Задержка между запросами
                await delay(1000);
                
            } catch (error) {
                console.error(`Ошибка при обработке ID ${companyId}:`, error.message);
                // Добавляем строку с ошибкой
                csvData += `"ОШИБКА: ${companyId}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла общая ошибка:', error.message);
    }
}

// Парсинг детальной информации компании
async function parseCompanyDetails(companyUrl, companyId) {
    try {
        const response = await axios.get(companyUrl, { 
            timeout: 15000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });
        
        console.log('Response data type:', typeof response.data);
        console.log('Response data:', response.data);
        
        // Если response.data уже массив, используем его напрямую
        let companyData;
        if (Array.isArray(response.data)) {
            companyData = response.data[0]; // Берем первый элемент массива
        } else if (typeof response.data === 'string') {
            // Если это строка, пытаемся извлечь JSON
            const jsonMatch = response.data.match(/\[.*\]/);
            if (jsonMatch) {
                const jsonData = JSON.parse(jsonMatch[0]);
                companyData = jsonData[0];
            } else {
                throw new Error('JSON не найден в ответе');
            }
        } else if (typeof response.data === 'object') {
            // Если это объект, используем его напрямую
            companyData = response.data;
        } else {
            throw new Error('Неизвестный формат ответа');
        }
        
        // Извлекаем данные из JSON
        const name = companyData.Name || '';
        const email = companyData.Email || '';
        const site = companyData.Site || '';
        // Телефон не указан в JSON структуре, поэтому оставляем пустым
        const phone = '';
        
        return {
            name: name,
            site: site,
            phone: phone,
            email: email
        };
        
    } catch (error) {
        console.error(`Ошибка при парсинге компании ${companyId}:`, error.message);
        throw error;
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