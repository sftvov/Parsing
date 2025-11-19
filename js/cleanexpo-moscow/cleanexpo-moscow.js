const axios = require('axios');
const fs = require('fs');

// НАСТРОЙКИ
const BASE_URL = 'https://www.cleanexpo-moscow.ru/ru-RU/about/exhibitor-list/exhibitorpopup.aspx?id=';
const MAIN_PAGE_URL = 'https://www.cleanexpo-moscow.ru/ru-RU/about/exhibitor-list.aspx';
const OUTPUT_FILENAME = 'cleanexpo-companies.csv';
const USE_ANSI_ENCODING = true;

// МАССИВ ID КОМПАНИЙ (нужно будет заполнить после сбора)
const COMPANY_IDS = [
  '111454',
  '111455',
  '111464',
  '111465',
  '111466',
  '111469',
  '111471',
  '111473',
  '111474',
  '111477',
  '111478',
  '111486',
  '111491',
  '111498',
  '111499',
  '111511',
  '111513',
  '111568',
  '111570',
  '111585',
  '111587',
  '111588',
  '111589',
  '111590',
  '111591',
  '111592',
  '111593',
  '111599',
  '111602',
  '111603',
  '111611',
  '111616',
  '111618',
  '111632',
  '111640',
  '111644',
  '111648',
  '111649',
  '111653',
  '111654',
  '111665',
  '111671',
  '111705',
  '111712',
  '111752',
  '111763',
  '111764',
  '111766',
  '111797',
  '111798',
  '111802',
  '111803',
  '111806',
  '111807',
  '111810',
  '111812',
  '111813',
  '111815',
  '111816',
  '111817',
  '111819',
  '111825',
  '111828',
  '111835',
  '111836',
  '111840',
  '111847',
  '111850',
  '111858',
  '111871',
  '111873',
  '111886',
  '111889',
  '111906',
  '111908',
  '111909',
  '111911',
  '111912',
  '111913',
  '111916',
  '111917',
  '111926',
  '111929',
  '111931',
  '111933',
  '111935',
  '111951',
  '111963',
  '111964',
  '111965',
  '111966',
  '111968',
  '111969',
  '111978',
  '111986',
  '111996',
  '112018',
  '112032',
  '112047',
  '112050',
  '112081',
  '112082',
  '112084',
  '112089',
  '112102',
  '112103',
  '112109',
  '112113',
  '112116',
  '112117',
  '112118',
  '112149',
  '112153',
  '112155',
  '112159',
  '112161',
  '112162',
  '112164',
  '112166',
  '112168',
  '112189',
  '112204',
  '112239',
  '112246',
  '112247',
  '112249',
  '112253',
  '112257',
  '112259',
  '112287',
  '112291',
  '112373',
  '112390',
  '112480',
  '112481',
  '112500',
  '112505',
  '112513',
  '112573',
  '112618',
  '112643',
  '112648',
  '112650',
  '112655',
  '112656',
  '112659',
  '112667',
  '112675',
  '112677',
  '112688',
  '112689',
  '112695',
  '112701',
  '112702',
  '112741',
  '112746',
  '112750',
  '112776',
  '112847',
  '112855',
  '112860',
  '112864',
];

async function parseCompanies() {
  try {
    console.log('Начинаем парсинг компаний CleanExpo...');

    // Если массив ID пустой, пытаемся загрузить из файла
    let idsToProcess = COMPANY_IDS;
    if (idsToProcess.length === 0) {
      try {
        const idsFile = fs.readFileSync('cleanexpo_ids.json', 'utf8');
        idsToProcess = JSON.parse(idsFile);
        console.log(`Загружено ID из файла: ${idsToProcess.length}`);
      } catch (error) {
        console.log('❌ Файл cleanexpo_ids.json не найден. Сначала соберите ID через Puppeteer.');
        return;
      }
    }

    console.log(`Всего компаний для обработки: ${idsToProcess.length}`);

    // Подготовка данных для CSV
    let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';

    // Обрабатываем каждую компанию по ID
    for (let i = 0; i < idsToProcess.length; i++) {
      const companyId = idsToProcess[i];
      const companyUrl = `${BASE_URL}${companyId}`;

      console.log(`Обрабатываем компанию [${i + 1}/${idsToProcess.length}]: ID ${companyId}`);

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
      email: email,
    };
  } catch (error) {
    console.error(`Ошибка при парсинге компании ${companyId}:`, error.message);
    throw error;
  }
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
