const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');
const Tesseract = require('tesseract.js');

const MAIN_DOMEN = `https://mc-expo.ru`;
const MAIN_URL = MAIN_DOMEN + `/ru/exhibition/participants`;
const OUTPUT_FILENAME = `mc-expo.csv`;
const USE_ANSI_ENCODING = true;

// Список стран для поиска в адресе
const COUNTRIES_LIST = [
    'Россия', 'Российская Федерация', 'РФ',
    'Turkey', 'Турция', 'Türkiye',
    'China', 'Китай', 'КНР',
    'Germany', 'Германия',
    'Italy', 'Италия',
    'France', 'Франция',
    'Spain', 'Испания',
    'Belarus', 'Беларусь',
    'Kazakhstan', 'Казахстан',
    'India', 'Индия',
    'USA', 'США', 'America',
    'Japan', 'Япония',
    'Korea', 'Корея',
    'Poland', 'Польша',
    'Czech', 'Чехия',
    'Austria', 'Австрия',
    'Switzerland', 'Швейцария',
    'Netherlands', 'Нидерланды',
    'UK', 'Великобритания', 'England'
];

// Функция для извлечения страны из адреса
function extractCountryFromAddress(addressText) {
    if (!addressText) return '';
    
    for (const country of COUNTRIES_LIST) {
        if (addressText.toLowerCase().includes(country.toLowerCase())) {
            return country;
        }
    }
    return '';
}

// Функция для извлечения email из текста
function extractEmailFromText(text) {
    if (!text) return '';
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
    const match = text.match(emailRegex);
    return match ? match[0] : '';
}

// Функция для распознавания текста с изображения
async function getTextFromImage(imageUrl) {
    try {
        console.log(`     🔍 Распознаем email с картинки: ${imageUrl.substring(0, 80)}...`);
        
        // Скачиваем изображение
        const response = await axios({
            url: imageUrl,
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const imageBuffer = response.data;
        
        // Распознаем текст
        const { data: { text } } = await Tesseract.recognize(
            imageBuffer,
            'rus+eng', // Русский и английский языки
            {
                logger: (m) => {
                    // Опционально: можно выводить прогресс, закомментировано для чистоты вывода
                    // if (m.status === 'recognizing text') {
                    //     console.log(`       Прогресс: ${Math.round(m.progress * 100)}%`);
                    // }
                }
            }
        );
        
        const cleanedText = text.trim();
        console.log(`     📝 Распознанный текст: "${cleanedText.substring(0, 50)}${cleanedText.length > 50 ? '...' : ''}"`);
        
        return cleanedText;
        
    } catch (error) {
        console.error(`     ❌ Ошибка распознавания картинки:`, error.message);
        return '';
    }
}

async function parseCompanies() {
    try {
        console.log('Начинаем парсинг...');
        console.log(`Основная страница: ${MAIN_URL}`);
        
        // Получаем главную страницу со списком компаний
        const mainPageResponse = await axios.get(MAIN_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const mainDom = new JSDOM(mainPageResponse.data);
        
        // Находим все строки таблицы с компаниями
        const companyRows = mainDom.window.document.querySelectorAll('table tbody tr');
        console.log(`Найдено компаний: ${companyRows.length}`);
        
        if (companyRows.length === 0) {
            console.log('Не найдено компаний. Проверьте структуру страницы.');
            return;
        }
        
        // Подготовка данных для CSV с полем "Страна"
        let csvData = 'Ссылка;Название;Сайт;Телефон;Email;Страна\n';
        
        // Обрабатываем каждую компанию
        for (let i = 0; i < companyRows.length; i++) {
            const row = companyRows[i];
            
            try {
                // Ищем ссылку на карточку компании в первом столбце
                const linkElement = row.querySelector('td:first-child a');
                if (!linkElement) {
                    console.log(`Пропускаем строку ${i + 1} - нет ссылки`);
                    continue;
                }
                
                const companyUrl = MAIN_DOMEN + linkElement.getAttribute('href');
                const companyName = linkElement.textContent.trim();
                
                console.log(`\n📄 [${i + 1}/${companyRows.length}]: ${companyName}`);
                console.log(`   🔗 URL: ${companyUrl}`);
                
                // Переходим на страницу компании
                const companyResponse = await axios.get(companyUrl, { 
                    timeout: 15000,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });
                const companyDom = new JSDOM(companyResponse.data);
                const companyDocument = companyDom.window.document;
                
                let site = '';
                let email = '';
                let phone = '';
                let country = '';
                let address = '';
                
                // Ищем все dt элементы в блоке с информацией
                const dtElements = companyDocument.querySelectorAll('dl.dl-horizontal dt');
                
                for (const dt of dtElements) {
                    const dtText = dt.textContent.trim();
                    const dd = dt.nextElementSibling;
                    
                    if (dd && dd.tagName === 'DD') {
                        const ddText = dd.textContent.trim();
                        
                        // Ищем телефон
                        if (dtText.includes('Телефон') || dtText.includes('телефон') || dtText.includes('Phone')) {
                            phone = ddText;
                            console.log(`   📞 Телефон: ${phone.substring(0, 50)}`);
                        }
                        // Ищем сайт
                        else if (dtText.includes('Сайт') || dtText.includes('сайт') || dtText.includes('Website')) {
                            const link = dd.querySelector('a');
                            site = link ? link.href : ddText;
                            console.log(`   🌐 Сайт: ${site || 'нет'}`);
                        }
                        // Ищем email - ОСНОВНОЙ МЕТОД: распознавание с картинки
                        else if (dtText.toLowerCase().includes('e-mail') || dtText.toLowerCase().includes('email')) {
                            console.log(`   📧 Поиск email...`);
                            
                            // Ищем картинку с email
                            const imgElement = dd.querySelector('img');
                            
                            if (imgElement && imgElement.src) {
                                // Email спрятан в картинке - используем Tesseract
                                const imageUrl = imgElement.src.startsWith('http') 
                                    ? imgElement.src 
                                    : MAIN_DOMEN + imgElement.src;
                                
                                const recognizedText = await getTextFromImage(imageUrl);
                                if (recognizedText) {
                                    email = extractEmailFromText(recognizedText);
                                    if (email) {
                                        console.log(`   ✅ Email распознан с картинки: ${email}`);
                                    } else {
                                        console.log(`   ⚠️ Текст распознан, но email не найден: "${recognizedText.substring(0, 50)}"`);
                                    }
                                }
                            } else {
                                // Если нет картинки, пробуем извлечь из текста
                                email = extractEmailFromText(ddText);
                                if (email) {
                                    console.log(`   📧 Email найден в тексте: ${email}`);
                                } else {
                                    console.log(`   ⚠️ Email не найден`);
                                }
                            }
                        }
                        // Ищем страну по полю "Страна"
                        else if (dtText.toLowerCase().includes('страна') || dtText.includes('Country')) {
                            country = ddText.trim();
                            console.log(`   🌍 Страна: ${country}`);
                        }
                        // Сохраняем адрес для поиска страны
                        else if (dtText.toLowerCase().includes('адрес') || dtText.includes('Address')) {
                            address = ddText.trim();
                            if (!country) {
                                country = extractCountryFromAddress(address);
                                if (country) {
                                    console.log(`   🌍 Страна из адреса: ${country}`);
                                }
                            }
                        }
                    }
                }
                
                // Альтернативный поиск сайта, если не нашли через dt/dd
                if (!site) {
                    const siteLinks = companyDocument.querySelectorAll('a[href^="http"]');
                    for (const link of siteLinks) {
                        const href = link.href;
                        if (href && !href.includes('metallurgy-russia.ru') && !href.includes('mailto:')) {
                            site = href;
                            break;
                        }
                    }
                }
                
                // Поиск страны из адреса, если не нашли
                if (!country && address) {
                    country = extractCountryFromAddress(address);
                }
                
                // Очищаем и форматируем данные
                const cleanName = companyName.replace(/"/g, '""').trim();
                const cleanSite = (site || '').replace(/"/g, '""').trim();
                const cleanPhone = (phone || '').replace(/"/g, '""').trim();
                const cleanEmail = (email || '').replace(/"/g, '""').trim();
                const cleanCountry = (country || '').replace(/"/g, '""').trim();
                
                // Добавляем данные в CSV
                csvData += `"${companyUrl}";"${cleanName}";"${cleanSite}";"${cleanPhone}";"${cleanEmail}";"${cleanCountry}"\n`;
                
                console.log(`   📊 Результат: Email: ${cleanEmail || 'не найден'}, Страна: ${cleanCountry || 'не найдена'}`);
                
                // Задержка между запросами
                await delay(3000);
                
            } catch (error) {
                console.error(`   ❌ Ошибка при обработке строки ${i + 1}:`, error.message);
                const linkElement = row.querySelector('td:first-child a');
                const companyName = linkElement ? linkElement.textContent.trim() : `Компания ${i + 1}`;
                const companyUrl = linkElement ? MAIN_DOMEN + linkElement.getAttribute('href') : '';
                csvData += `"${companyUrl}";"${companyName.replace(/"/g, '""')}";"ОШИБКА";"ОШИБКА";"ОШИБКА";""\n`;
            }
        }
        
        // Сохраняем результат
        saveToFile(csvData, OUTPUT_FILENAME);
        console.log(`\n✅ Данные сохранены в ${OUTPUT_FILENAME}`);
        
    } catch (error) {
        console.error('Произошла ошибка:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Вспомогательные функции
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveToFile(data, filename) {
    try {
        if (USE_ANSI_ENCODING) {
            const iconv = require('iconv-lite');
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
    }
}

// Запускаем парсинг
parseCompanies();