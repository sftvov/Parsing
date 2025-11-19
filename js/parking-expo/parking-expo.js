const axios = require('axios');
const fs = require('fs');

// НАСТРОЙКИ
const BASE_URL = 'https://parking-expo.ru/ru-RU/about/exhibitor-list/exhibitorview.aspx?id=';
const MAIN_PAGE_URL = 'https://parking-expo.ru/ru-RU/about/exhibitor-list.aspx';
const OUTPUT_FILENAME = 'parking-expo-companies.csv';
const USE_ANSI_ENCODING = true;

// МАССИВ ID КОМПАНИЙ (нужно будет заполнить после сбора)
const COMPANY_IDS = [];

async function parseCompanies() {
  try {
    console.log('Начинаем парсинг компаний Parking-Expo...');

    // Если массив ID пустой, пытаемся загрузить из файла
    let idsToProcess = COMPANY_IDS;
    if (idsToProcess.length === 0) {
      try {
        const idsFile = fs.readFileSync('parking_expo_ids.json', 'utf8');
        idsToProcess = JSON.parse(idsFile);
        console.log(`Загружено ID из файла: ${idsToProcess.length}`);
      } catch (error) {
        console.log('❌ Файл parking_expo_ids.json не найден. Сначала соберите ID через Puppeteer.');
        return;
      }
    }

    console.log(`Всего компаний для обработки: ${idsToProcess.length}`);

    // Подготовка данных для CSV - ТОЛЬКО НУЖНЫЕ ПОЛЯ
    let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';

    // Обрабатываем каждую компанию по ID
    for (let i = 0; i < idsToProcess.length; i++) {
      const companyId = idsToProcess[i];
      const companyUrl = `${BASE_URL}${companyId}`;

      console.log(`Обрабатываем компанию [${i + 1}/${idsToProcess.length}]: ID ${companyId}`);

      try {
        const companyDetails = await parseCompanyDetails(companyUrl, companyId);

        // Добавляем данные в CSV ТОЛЬКО С НУЖНЫМИ ПОЛЯМИ
        csvData += `"${companyUrl}";"${companyDetails.name}";"${companyDetails.site}";"${companyDetails.phone}";"${companyDetails.email}"\n`;

        console.log(`  Найдено: ${companyDetails.name}`);
        console.log(`  Сайт: ${companyDetails.site || 'нет'}`);
        console.log(`  Телефон: ${companyDetails.phone || 'нет'}`);
        console.log(`  Email: ${companyDetails.email || 'нет'}`);

        // Задержка между запросами
        await delay(1500);
      } catch (error) {
        console.error(`Ошибка при обработке ID ${companyId}:`, error.message);
        // Добавляем строку с ошибкой
        csvData += `"${companyUrl}";"ОШИБКА: ${companyId}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
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
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    // Обрабатываем разные форматы ответа
    let companyData;
    if (Array.isArray(response.data)) {
      companyData = response.data[0]; // Берем первый элемент массива
    } else if (typeof response.data === 'string') {
      // Если это строка, пытаемся извлечь JSON
      const jsonMatch = response.data.match(/\[.*\]/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[0]);
          companyData = jsonData[0];
        } catch (parseError) {
          // Если не удалось распарсить JSON, ищем в HTML
          const htmlJsonMatch = response.data.match(/<pre[^>]*>(\[.*\])<\/pre>/);
          if (htmlJsonMatch) {
            const jsonData = JSON.parse(htmlJsonMatch[1]);
            companyData = jsonData[0];
          } else {
            throw new Error('JSON не найден в ответе');
          }
        }
      } else {
        throw new Error('JSON не найден в ответе');
      }
    } else if (typeof response.data === 'object') {
      // Если это объект, используем его напрямую
      companyData = response.data;
    } else {
      throw new Error('Неизвестный формат ответа');
    }

    // Извлекаем ТОЛЬКО НУЖНЫЕ ДАННЫЕ из JSON структуры
    const name = cleanText(companyData.Name || '');
    const email = cleanText(companyData.Email || '');
    const site = cleanText(companyData.Site || '');
    // Телефон не указан в JSON структуре parking-expo, поэтому оставляем пустым
    const phone = '';

    return {
      name: name,
      site: site,
      phone: phone,
      email: email,
    };
  } catch (error) {
    console.error(`Ошибка при парсинге компании ${companyId}:`, error.message);
    throw error;
  }
}

// Функция для очистки текста от HTML тегов и лишних пробелов
function cleanText(text) {
  if (!text) return '';
  
  // Удаляем HTML теги
  let cleaned = text.replace(/<[^>]*>/g, '');
  // Заменяем HTML entities
  cleaned = cleaned.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // Удаляем лишние пробелы и переносы строк
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Вспомогательные функции
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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