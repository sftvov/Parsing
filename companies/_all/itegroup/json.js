const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

// НАСТРОЙКИ
const START_URL = 'https://exhibitors-itegroup.exhibitoronlinemanual.com/trans-russia-2026/ru/Exhibitor';
const OUTPUT_FILENAME = 'itegroup_company_links.json';

// Создаем интерфейс для ввода с клавиатуры
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Функция для загрузки существующих ссылок из JSON
function loadExistingLinks() {
    try {
        if (fs.existsSync(OUTPUT_FILENAME)) {
            const data = fs.readFileSync(OUTPUT_FILENAME, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.log('⚠️  Не удалось загрузить существующий файл, создаем новый');
    }
    return [];
}

// Функция для сохранения ссылок в JSON
function saveLinksToJson(links) {
    try {
        const jsonData = JSON.stringify(links, null, 2);
        fs.writeFileSync(OUTPUT_FILENAME, jsonData, 'utf8');
        console.log(`💾 Сохранено ${links.length} ссылок в ${OUTPUT_FILENAME}`);
    } catch (error) {
        console.error('❌ Ошибка сохранения файла:', error.message);
    }
}

// Функция для сбора ссылок с текущей страницы
async function collectLinksFromCurrentPage(page) {
    try {
        const links = await page.evaluate(() => {
            const linkElements = document.querySelectorAll('.card-title > a');
            
            const collectedLinks = [];
            linkElements.forEach(link => {
                const href = link.getAttribute('href');
                const text = link.textContent.trim();
                
                if (href) {
                    const fullUrl = href.startsWith('http') 
                        ? href 
                        : new URL(href, window.location.origin).href;
                    
                    collectedLinks.push({
                        url: fullUrl,
                        title: text || 'Без названия',
                        collectedAt: new Date().toISOString()
                    });
                }
            });
            
            return collectedLinks;
        });
        
        return links;
    } catch (error) {
        console.error('❌ Ошибка при сборе ссылок:', error.message);
        return [];
    }
}

// Функция для ожидания команды
function waitForCommand() {
    return new Promise((resolve) => {
        rl.question('', (answer) => {
            resolve(answer.toLowerCase().trim());
        });
    });
}

// Основная функция
async function collectLinks() {
    console.log('='.repeat(70));
    console.log('🚀 СБОРЩИК ССЫЛОК: TransRussia 2026');
    console.log('='.repeat(70));
    console.log(`🌐 Стартовая страница: ${START_URL}`);
    console.log(`📁 Файл: ${OUTPUT_FILENAME}`);
    console.log('='.repeat(70));
    console.log('\n📋 ИНСТРУКЦИЯ:');
    console.log('1. Браузер откроется на странице списка участников');
    console.log('2. Можете свободно перемещаться по сайту');
    console.log('3. Для сбора ссылок с текущей страницы введите: collect (или просто Enter)');
    console.log('4. Для завершения введите: stop');
    console.log('5. Для показа статистики введите: stats');
    console.log('='.repeat(70) + '\n');
    
    let browser = null;
    
    try {
        // Загружаем существующие ссылки
        let allLinks = loadExistingLinks();
        console.log(`📂 Загружено существующих ссылок: ${allLinks.length}`);
        
        // Создаем Set существующих URL для быстрой проверки дубликатов
        const existingUrls = new Set(allLinks.map(link => link.url));
        
        // Запускаем браузер
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 1366, height: 768 },
            args: ['--start-maximized']
        });
        
        const page = await browser.newPage();
        
        // Переходим на стартовую страницу
        console.log('\n🔍 Открываем страницу списка участников...');
        await page.goto(START_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        
        console.log('✅ Браузер готов! Вы можете перемещаться по сайту.\n');
        console.log('📢 Доступные команды:');
        console.log('   [Enter] или "collect" - собрать ссылки с текущей страницы');
        console.log('   "stats" - показать статистику');
        console.log('   "stop" - завершить работу\n');
        
        let isRunning = true;
        
        while (isRunning) {
            console.log('⏸️  Ожидание команды...');
            const command = await waitForCommand();
            
            switch(command) {
                case '':
                case 'collect':
                case 'собрать':
                    console.log('\n🔍 Собираем ссылки с текущей страницы...');
                    
                    const currentLinks = await collectLinksFromCurrentPage(page);
                    
                    if (currentLinks.length > 0) {
                        // Находим новые ссылки
                        const newLinks = currentLinks.filter(link => !existingUrls.has(link.url));
                        
                        if (newLinks.length > 0) {
                            console.log(`✅ Найдено ${newLinks.length} НОВЫХ ссылок:`);
                            
                            newLinks.slice(0, 5).forEach((link, i) => {
                                console.log(`   ${i+1}. ${link.title}`);
                            });
                            
                            if (newLinks.length > 5) {
                                console.log(`   ... и еще ${newLinks.length - 5} новых ссылок`);
                            }
                            
                            // Добавляем новые ссылки
                            allLinks = [...allLinks, ...newLinks];
                            newLinks.forEach(link => existingUrls.add(link.url));
                            
                            console.log(`📊 Всего ссылок: ${allLinks.length} (+${newLinks.length} новых)`);
                            
                            // Сохраняем
                            saveLinksToJson(allLinks);
                        } else {
                            console.log(`ℹ️  На странице ${currentLinks.length} ссылок, но все уже есть в базе`);
                        }
                    } else {
                        console.log('⚠️  На странице не найдено ссылок (.card-title > a)');
                    }
                    break;
                    
                case 'stats':
                case 'статистика':
                    console.log(`\n📊 Статистика:`);
                    console.log(`   - Всего уникальных ссылок: ${allLinks.length}`);
                    console.log(`   - Файл: ${OUTPUT_FILENAME}`);
                    break;
                    
                case 'stop':
                case 'стоп':
                case 'exit':
                case 'quit':
                    console.log('⏹️  Завершаем работу...');
                    isRunning = false;
                    break;
                    
                default:
                    console.log(`❓ Неизвестная команда: "${command}"`);
                    console.log('   Доступные команды: [Enter], collect, stats, stop');
            }
            
            console.log(''); // Пустая строка для разделения
        }
        
        // Финальная статистика
        console.log('\n' + '='.repeat(70));
        console.log('📊 ФИНАЛЬНАЯ СТАТИСТИКА:');
        console.log('='.repeat(70));
        console.log(`✅ Всего уникальных ссылок: ${allLinks.length}`);
        console.log(`📁 Файл: ${OUTPUT_FILENAME}`);
        
        if (allLinks.length > 0) {
            console.log('\n📋 Первые 10 ссылок:');
            allLinks.slice(0, 10).forEach((link, i) => {
                console.log(`${i+1}. ${link.title}: ${link.url}`);
            });
        }
        console.log('='.repeat(70));
        
    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    } finally {
        rl.close();
        if (browser) {
            console.log('\n🔄 Закрываем браузер...');
            await browser.close();
        }
        console.log('✅ Программа завершена');
    }
}

// Запуск
collectLinks();