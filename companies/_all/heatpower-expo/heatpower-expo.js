const axios = require('axios');
const fs = require('fs');

// НАСТРОЙКИ
const BASE_URL = 'https://www.heatpower-expo.ru/ru-RU/about/exhibitor-list/exhibitorpopup.aspx?id=';
const MAIN_PAGE_URL = 'https://www.heatpower-expo.ru/ru-RU/about/exhibitor-list.aspx';
const OUTPUT_FILENAME = 'heatpower-expo-companies.csv';
const USE_ANSI_ENCODING = true;

// МАССИВ ID КОМПАНИЙ
const COMPANY_IDS = [
  "111382", "111387", "111431", "111488", "111510", "111533", "111539", 
  "111656", "111658", "111662", "111663", "111680", "111682", "111709", 
  "111710", "111721", "111741", "111771", "111808", "111844", "111869", 
  "111936", "111990", "111991", "111992", "111995", "111999", "112000", 
  "112020", "112034", "112059", "112074", "112129", "112133", "112140", 
  "112144", "112160", "112167", "112170", "112192", "112195", "112198", 
  "112209", "112213", "112216", "112219", "112238", "112265", "112284", 
  "112285", "112303", "112314", "112316", "112329", "112331", "112347", 
  "112375", "112382", "112387", "112402", "112419", "112429", "112453", 
  "112466", "112490", "112507", "112637", "112663", "112698", "112794"
];

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг компаний Heatpower Expo...');
        console.log(`Всего компаний для обработки: ${COMPANY_IDS.length}`);
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждую компанию по ID
        for (let i = 0; i < COMPANY_IDS.length; i++) {
            const companyId = COMPANY_IDS[i];
            const companyUrl = `${BASE_URL}${companyId}`;
            
            console.log(`Обрабатываем компанию [${i + 1}/${COMPANY_IDS.length}]: ID ${companyId}`);
            
            try {
                const companyDetails = await parseCompanyDetails(companyUrl, companyId);
                
                // Добавляем данные в CSV
                csvData += `"${MAIN_PAGE_URL}";"${companyDetails.name}";"${companyDetails.site}";"${companyDetails.phone}";"${companyDetails.email}"\n`;
                
                console.log(`  Найдено: ${companyDetails.name}`);
                console.log(`  Сайт: ${companyDetails.site || 'нет'}`);
                console.log(`  Телефон: ${companyDetails.phone || 'нет'}`);
                console.log(`  Email: ${companyDetails.email || 'нет'}`);
                
                // Задержка между запросами
                await delay(1000);
                
            } catch (error) {
                console.error(`Ошибка при обработке ID ${companyId}:`, error.message);
                // Добавляем строку с ошибкой
                csvData += `"${MAIN_PAGE_URL}";"ОШИБКА: ${companyId}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
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
        
        // Обрабатываем разные форматы ответа
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