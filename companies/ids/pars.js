const axios = require('axios');
const fs = require('fs');
const iconv = require('iconv-lite');

// КОНФИГУРАЦИЯ ПАРСЕРА
const CONFIG = {
  // === НАСТРОЙКИ ВЫСТАВКИ (меняются для каждой) ===
  name: 'CleanExpo Moscow',                          // Название для отображения
  baseUrl: 'https://www.cleanexpo-moscow.ru/ru-RU/about/exhibitor-list/exhibitorpopup.aspx?id=',
  mainPageUrl: 'https://www.cleanexpo-moscow.ru/ru-RU/about/exhibitor-list.aspx',
  
  // === НАСТРОЙКИ ПАРСИНГА ===
  responseType: 'json',                               // 'json', 'jsonp', 'html'
  jsonPath: '[0]',                                    // Путь к данным в JSON (например, '[0]' или 'data.companies[0]')
  nameField: 'Name',                                  // Поле с названием
  emailField: 'Email',                                // Поле с email
  siteField: 'Site',                                  // Поле с сайтом
  phoneField: null,                                   // Поле с телефоном (null если нет)
  
  // Для HTML парсинга (если responseType = 'html')
  htmlSelector: null,                                 // CSS селектор для блока с данными
  nameSelector: null,                                 // Селектор для названия
  emailSelector: null,                                // Селектор для email
  siteSelector: null,                                 // Селектор для сайта
  phoneSelector: null,                                // Селектор для телефона
  
  // === ТЕХНИЧЕСКИЕ НАСТРОЙКИ ===
  delayBetweenRequests: 1000,
  timeout: 15000,
  useAnsiEncoding: true,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  }
};

// КОНФИГУРАЦИИ ДЛЯ РАЗНЫХ ВЫСТАВОК
const EXPO_CONFIGS = {
  // CleanExpo Moscow
  cabex: {
    name: 'cabex',
    url: 'https://www.cabex.ru/ru-RU/about/exhibitor-list',
    baseUrl: 'https://www.cabex.ru/ru-RU/about/exhibitor-list/exhibitorpopup.aspx?id=',
    mainPageUrl: 'https://www.cabex.ru/ru-RU/about/exhibitor-list.aspx',
    responseType: 'json',
    jsonPath: '[0]',
    nameField: 'Name',
    emailField: 'Email',
    siteField: 'Site',
    phoneField: null
  },
  cleanexpo: {
    name: 'CleanExpo Moscow',
    baseUrl: 'https://www.cleanexpo-moscow.ru/ru-RU/about/exhibitor-list/exhibitorpopup.aspx?id=',
    mainPageUrl: 'https://www.cleanexpo-moscow.ru/ru-RU/about/exhibitor-list.aspx',
    responseType: 'json',
    jsonPath: '[0]',
    nameField: 'Name',
    emailField: 'Email',
    siteField: 'Site',
    phoneField: null
  },
};

// РЕГУЛЯРНЫЕ ВЫРАЖЕНИЯ для HTML парсинга
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(\+?[78]|\+\s?375|\+\s?90)[\s(-]*(?:\d{2,4}[\s)-]*){2,4}[\s-]*\d{2,3}[\s-]*\d{2,4}(?:\/\d{2,4})?/g;
const URL_REGEX = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9а-яА-ЯёЁ\-]+\.[a-zA-Zа-яА-ЯёЁ]{2,}(?:\/[^\s<>"{}|\\^\[\]`]*)?\b/gi;

// Функция для выбора конфигурации
function selectConfig() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 УНИВЕРСАЛЬНЫЙ ПАРСЕР ВЫСТАВОК');
    console.log('='.repeat(60));
    
    const keys = Object.keys(EXPO_CONFIGS);
    console.log('\nДоступные выставки:');
    keys.forEach((key, index) => {
      console.log(`  ${index + 1}. ${EXPO_CONFIGS[key].name}`);
    });
    
    rl.question('\nВыберите номер выставки: ', (answer) => {
      rl.close();
      
      const num = parseInt(answer);
      if (!isNaN(num) && num >= 1 && num <= keys.length) {
        resolve(EXPO_CONFIGS[keys[num - 1]]);
      } else {
        console.log('❌ Неверный выбор, используем CleanExpo');
        resolve(EXPO_CONFIGS.cleanexpo);
      }
    });
  });
}

// Основная функция парсинга
async function parseExpo(config) {
  try {
    console.log('\n' + '='.repeat(60));
    console.log(`🚀 ПАРСЕР: ${config.name}`);
    console.log('='.repeat(60));
    console.log(`📁 Выходной файл: ${config.name}.csv`);
    console.log(`📄 Файл с ID: ${config.name}_ids.json`);
    console.log('='.repeat(60) + '\n');

    // Загружаем ID компаний
    let idsToProcess = [];
    try {
      const idsFile = fs.readFileSync(config.name + '_ids.json', 'utf8');
      idsToProcess = JSON.parse(idsFile);
      console.log(`✅ Загружено ID из файла: ${idsToProcess.length}\n`);
    } catch (error) {
      console.log(`❌ Файл ${config.name + '_ids.json'} не найден. Сначала соберите ID.`);
      return;
    }

    // Подготовка данных для CSV
    let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
    let successCount = 0;
    let errorCount = 0;
    let foundStats = { site: 0, phone: 0, email: 0 };

    // Обрабатываем каждую компанию
    for (let i = 0; i < idsToProcess.length; i++) {
      const companyId = idsToProcess[i];
      const companyUrl = config.baseUrl.endsWith('=') 
        ? `${config.baseUrl}${companyId}`
        : `${config.baseUrl}${companyId}`;

      console.log(`📄 [${i + 1}/${idsToProcess.length}] ID: ${companyId}`);

      try {
        const companyDetails = await parseCompanyDetails(companyUrl, companyId, config);

        // Добавляем данные в CSV
        csvData += `"${companyUrl}";"${companyDetails.name}";"${companyDetails.site}";"${companyDetails.phone}";"${companyDetails.email}"\n`;

        // Статистика
        if (companyDetails.name) successCount++;
        if (companyDetails.site) foundStats.site++;
        if (companyDetails.phone) foundStats.phone++;
        if (companyDetails.email) foundStats.email++;

        console.log(`   Название: ${companyDetails.name || 'нет'}`);
        console.log(`   Сайт: ${companyDetails.site || 'нет'}`);
        console.log(`   Телефон: ${companyDetails.phone || 'нет'}`);
        console.log(`   Email: ${companyDetails.email || 'нет'}`);

        await delay(config.delayBetweenRequests || 1000);

      } catch (error) {
        console.error(`   ❌ Ошибка: ${error.message}`);
        csvData += `"${companyUrl}";"ОШИБКА: ${companyId}";"ОШИБКА";"ОШИБКА";"ОШИБКА"\n`;
        errorCount++;
      }
    }

    // Сохраняем результат
    saveToFile(csvData, config.outputFile + '.csv', config.useAnsiEncoding !== false);
    
    // Статистика
    console.log('\n' + '='.repeat(60));
    console.log('📊 СТАТИСТИКА:');
    console.log('='.repeat(60));
    console.log(`📊 Всего компаний: ${idsToProcess.length}`);
    console.log(`✅ Успешно: ${successCount}`);
    console.log(`❌ Ошибок: ${errorCount}`);
    console.log('─'.repeat(60));
    console.log(`🌐 Найдено сайтов: ${foundStats.site}`);
    console.log(`📞 Найдено телефонов: ${foundStats.phone}`);
    console.log(`✉️  Найдено email: ${foundStats.email}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('💥 Критическая ошибка:', error.message);
  }
}

// Парсинг детальной информации компании
async function parseCompanyDetails(companyUrl, companyId, config) {
  try {
    const response = await axios.get(companyUrl, {
      timeout: config.timeout || 15000,
      headers: config.headers || {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    // Обработка в зависимости от типа ответа
    if (config.responseType === 'json') {
      return parseJsonResponse(response.data, config);
    } else {
      return parseHtmlResponse(response.data, config);
    }

  } catch (error) {
    console.error(`Ошибка при парсинге компании ${companyId}:`, error.message);
    throw error;
  }
}

// Парсинг JSON ответа
function parseJsonResponse(data, config) {
  let companyData = data;
  
  // Извлекаем данные по JSON Path
  if (config.jsonPath) {
    const pathParts = config.jsonPath.replace(/\[(\d+)\]/g, '.$1').split('.');
    for (const part of pathParts) {
      if (part && companyData) {
        companyData = companyData[part];
      }
    }
  }

  if (Array.isArray(companyData)) {
    companyData = companyData[0];
  }

  return {
    name: getNestedValue(companyData, config.nameField) || '',
    site: getNestedValue(companyData, config.siteField) || '',
    email: getNestedValue(companyData, config.emailField) || '',
    phone: config.phoneField ? getNestedValue(companyData, config.phoneField) || '' : ''
  };
}

// Парсинг HTML ответа
function parseHtmlResponse(html, config) {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(html);
  const document = dom.window.document;

  let name = '', site = '', email = '', phone = '';

  // Ищем блок с контактами
  const contactBlock = config.htmlSelector 
    ? document.querySelector(config.htmlSelector)
    : document.body;

  if (contactBlock) {
    // Парсим по селекторам
    if (config.nameSelector) {
      const nameEl = contactBlock.querySelector(config.nameSelector);
      name = nameEl ? nameEl.textContent.trim() : '';
    }

    if (config.emailSelector) {
      const emailEl = contactBlock.querySelector(config.emailSelector);
      if (emailEl) {
        const href = emailEl.getAttribute('href');
        email = href ? href.replace('mailto:', '') : emailEl.textContent.trim();
      }
    }

    if (config.siteSelector) {
      const siteEl = contactBlock.querySelector(config.siteSelector);
      if (siteEl) {
        const href = siteEl.getAttribute('href');
        site = href && href.startsWith('http') ? href : siteEl.textContent.trim();
      }
    }

    if (config.phoneSelector) {
      const phoneEl = contactBlock.querySelector(config.phoneSelector);
      phone = phoneEl ? phoneEl.textContent.trim() : '';
    }
  }

  // Если не нашли по селекторам, ищем по регуляркам
  const text = document.body.textContent;
  
  if (!email) {
    const emailMatch = text.match(EMAIL_REGEX);
    email = emailMatch ? emailMatch[0] : '';
  }
  
  if (!phone) {
    const phoneMatch = text.match(PHONE_REGEX);
    phone = phoneMatch ? cleanPhone(phoneMatch[0]) : '';
  }
  
  if (!site) {
    const siteMatch = text.match(URL_REGEX);
    if (siteMatch) {
      for (const url of siteMatch) {
        if (isValidWebsite(url, config.baseUrl)) {
          site = cleanWebsite(url);
          break;
        }
      }
    }
  }

  return {
    name: name,
    site: site,
    phone: phone,
    email: email
  };
}

// Вспомогательные функции
function getNestedValue(obj, path) {
  if (!obj || !path) return null;
  return path.split('.').reduce((current, key) => current && current[key], obj);
}

function cleanWebsite(site) {
  if (!site) return '';
  site = site.replace(/^[^\w]*|[^\w]*$/g, '');
  if (site && !site.startsWith('http')) {
    site = 'http://' + site;
  }
  return site;
}

function isValidWebsite(site, baseUrl) {
  if (!site || site.includes('mailto:') || site.includes('tel:') ||
      site.includes('#') || site.includes('javascript:') ||
      site.length <= 4 || !site.includes('.')) {
    return false;
  }
  // Исключаем домен самой выставки
  if (baseUrl && site.includes(new URL(baseUrl).hostname)) {
    return false;
  }
  return true;
}

function cleanPhone(phone) {
  return phone.replace(/\s+/g, ' ').trim();
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToFile(data, filename, useAnsi) {
  if (useAnsi) {
    try {
      const iconv = require('iconv-lite');
      const buffer = iconv.encode(data, 'win1251');
      fs.writeFileSync(filename, buffer);
      console.log(`💾 Файл сохранен в кодировке Windows-1251`);
    } catch (error) {
      console.log(`⚠️ Ошибка кодировки, сохраняем в UTF-8`);
      fs.writeFileSync(filename, data, 'utf8');
    }
  } else {
    fs.writeFileSync(filename, data, 'utf8');
  }
}

// Главная функция
async function main() {
  const config = await selectConfig();
  await parseExpo(config);
}

// Запуск
main();