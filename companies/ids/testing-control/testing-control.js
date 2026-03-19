const axios = require('axios');
const fs = require('fs');

// НАСТРОЙКИ
const BASE_URL = 'https://www.testing-control.ru/ru-RU/about/exhibitor-list/exhibitorpopup.aspx?id=';
const MAIN_PAGE_URL = 'https://www.testing-control.ru/ru-RU/about/exhibitor-list.aspx';
const OUTPUT_FILENAME = 'testing-control-companies.csv';
const USE_ANSI_ENCODING = true;

// МАССИВ ID КОМПАНИЙ
const COMPANY_IDS = [
  "111400", "111402", "111403", "111404", "111410", "111415", "111422", 
  "111426", "111429", "111430", "111438", "111443", "111456", "111468", 
  "111470", "111490", "111494", "111496", "111507", "111515", "111532", 
  "111543", "111566", "111621", "111669", "111681", "111703", "111720", 
  "111725", "111755", "111769", "111773", "111780", "111805", "111814", 
  "111830", "111890", "111893", "111894", "111896", "111897", "111900", 
  "111901", "111904", "111905", "111907", "111910", "111921", "111932", 
  "111953", "111982", "111989", "112011", "112012", "112013", "112016", 
  "112033", "112036", "112038", "112053", "112060", "112064", "112066", 
  "112068", "112075", "112097", "112098", "112120", "112126", "112134", 
  "112138", "112139", "112145", "112148", "112156", "112157", "112169", 
  "112171", "112177", "112178", "112179", "112180", "112184", "112185", 
  "112187", "112217", "112230", "112243", "112244", "112245", "112248", 
  "112251", "112254", "112255", "112258", "112261", "112271", "112275", 
  "112276", "112283", "112290", "112311", "112318", "112332", "112366", 
  "112371", "112372", "112377", "112381", "112384", "112395", "112404", 
  "112424", "112430", "112519", "112606", "112624"
];

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг компаний Testing Control...');
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