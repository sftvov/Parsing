const axios = require('axios');
const fs = require('fs');
const iconv = require('iconv-lite');

// Базовый URL API экспонентов
const baseApiUrl = 'https://personal-account.expovr.ru/api/exhibitors/search';

// Параметры
const testParams = {
    find: '',
    skip: '',
    limit: '',
    event: '6822faafad7356cfb03ebf93',
    dates: '',
    categories: '',
    countries: '',
    lang: 'ru',
    where: 'index'
};

// НАСТРОЙКА КОДИРОВКИ - меняйте здесь true/false
const USE_ANSI_ENCODING = true; // true - ANSI (Windows-1251), false - UTF-8

// Формируем полный URL
function buildApiUrl(params) {
    const queryParams = new URLSearchParams(params).toString();
    return `${baseApiUrl}?${queryParams}`;
}

const apiUrl = buildApiUrl(testParams);

async function parseExhibitors() {
    try {
        console.log('Начинаем загрузку данных...');
        console.log(`Кодировка: ${USE_ANSI_ENCODING ? 'ANSI (Windows-1251)' : 'UTF-8'}`);
        
        // Делаем GET-запрос к API
        const response = await axios.get(apiUrl);
        
        if (response.status !== 200) {
            throw new Error(`Ошибка HTTP: ${response.status}`);
        }
        
        const data = response.data;
        
        if (!data.exhibitors || !Array.isArray(data.exhibitors)) {
            throw new Error('Некорректная структура ответа: отсутствует массив exhibitors');
        }
        
        console.log(`Получено ${data.exhibitors.length} экспонентов`);
        
        // Подготовка данных для CSV
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email\n';
        
        // Обрабатываем каждого экспонента
        data.exhibitors.forEach(exhibitor => {
            // Безопасное извлечение данных
            const link = "https://personal-account.expovr.ru/catalog/exhibitor/" + safeToString(exhibitor._id);
            const name = safeToString(exhibitor.name && exhibitor.name.ru);
            const description = safeToString(exhibitor.brief && exhibitor.brief.ru);
            const website = safeToString(exhibitor.contacts && exhibitor.contacts.www);
            const phone = safeToString(exhibitor.contacts && exhibitor.contacts.phone);
            const email = safeToString(exhibitor.contacts && exhibitor.contacts.email);
            
            // Экранируем специальные символы для CSV
            const escapeCsv = (str) => {
                if (!str) return '';
                const stringValue = safeToString(str);
                if (stringValue.includes(';') || stringValue.includes('"')) {
                    return `"${stringValue.replace(/"/g, '""')}"`;
                }
                return stringValue;
            };
            
            // Добавляем строку в CSV
            csvData += `${escapeCsv(link)};${escapeCsv(name)};${escapeCsv(website)};${escapeCsv(phone)};${escapeCsv(email)}\n`;
        });
        
        // Формируем имя файла в зависимости от кодировки
        const encodingSuffix = USE_ANSI_ENCODING ? '_ansi' : '_utf8';
        const filename = `expovision_${testParams.event}${encodingSuffix}.csv`;
        
        // Сохраняем в нужной кодировке
        if (USE_ANSI_ENCODING) {
            // Конвертируем в Windows-1251 (ANSI)
            const csvBuffer = iconv.encode(csvData, 'win1251');
            fs.writeFileSync(filename, csvBuffer);
        } else {
            // Сохраняем в UTF-8
            fs.writeFileSync(filename, csvData, 'utf8');
        }
        
        console.log(`Данные успешно сохранены в файл ${filename}`);
        console.log(`Размер файла: ${Math.round(Buffer.byteLength(csvData) / 1024)} KB`);
        
    } catch (error) {
        console.error('Произошла ошибка:', error.message);
    }
}

// Безопасное преобразование любого значения в строку
function safeToString(value) {
    if (value === null || value === undefined) {
        return '';
    }
    if (typeof value === 'object') {
        return JSON.stringify(value);
    }
    return String(value);
}

// Запускаем парсинг
parseExhibitors();