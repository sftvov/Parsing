const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

// КОНФИГУРАЦИЯ
const CONFIG = {
  // === НАСТРОЙКИ ДЛЯ CLEANEXPO ===
  cabex: {
    name: 'cabex',
    url: 'https://www.cabex.ru/ru-RU/about/exhibitor-list.aspx',
    waitForSelector: '.participant_block',
    idSelector: '.participant_block [data-exib]',
    idAttribute: 'data-exib',
  },
  cleanexpo: {
    name: 'cleanExpoMoscow',
    url: 'https://www.cleanexpo-moscow.ru/ru-RU/about/exhibitor-list.aspx',
    waitForSelector: '.participant_block',
    idSelector: '.participant_block [data-exib]',
    idAttribute: 'data-exib',
  },
};

// Функция для выбора конфигурации
function selectConfig() {
  console.log('\n' + '='.repeat(50));
  console.log('🎯 УНИВЕРСАЛЬНЫЙ СБОРЩИК ID КОМПАНИЙ');
  console.log('='.repeat(50));
  
  const keys = Object.keys(CONFIG);
  console.log('\nДоступные выставки:');
  keys.forEach((key, index) => {
    console.log(`  ${index + 1}. ${CONFIG[key].name}`);
  });
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question('\nВыберите номер выставки (или введите название): ', (answer) => {
      rl.close();
      
      // Проверяем по номеру
      const num = parseInt(answer);
      if (!isNaN(num) && num >= 1 && num <= keys.length) {
        resolve(CONFIG[keys[num - 1]]);
        return;
      }
      
      // Проверяем по названию ключа
      if (CONFIG[answer]) {
        resolve(CONFIG[answer]);
        return;
      }
      
      console.log('❌ Неверный выбор, используем cleanexpo по умолчанию');
      resolve(CONFIG.cleanexpo);
    });
  });
}

// Основная функция сбора ID
async function collectIds(config) {
    console.log(`\n🚀 Начинаем сбор ID для: ${config.name}`);
    console.log(`🌐 URL: ${config.url}`);
    console.log('='.repeat(50) + '\n');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    const allIds = new Set();
    
    try {
        // Переходим на страницу
        console.log('📡 Загружаем страницу...');
        await page.goto(config.url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        // Ждем появления элементов
        if (config.waitForSelector) {
            await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
        }
        
        console.log('\n📋 ИНСТРУКЦИЯ:');
        console.log('='.repeat(40));
        console.log('1. Скрипт будет собирать ID с текущей страницы');
        console.log('2. ВРУЧНУЕ переходите по страницам в браузере');
        console.log('3. После каждого перехода нажмите Enter в консоли');
        console.log('4. Для завершения введите "save"');
        console.log('='.repeat(40) + '\n');
        
        let pageNumber = 1;
        
        while (true) {
            // Собираем ID с текущей страницы
            const ids = await page.evaluate((cfg) => {
                const elements = document.querySelectorAll(cfg.idSelector);
                const idList = [];
                
                for (const el of elements) {
                    let id = null;
                    
                    if (cfg.idAttribute) {
                        id = el.getAttribute(cfg.idAttribute);
                    }
                    
                    // Если есть функция извлечения, применяем её
                    if (cfg.idExtractor && id) {
                        // Примечание: функция idExtractor не может быть передана напрямую
                        // Мы передадим id в строковом виде и обработаем позже
                        idList.push({ raw: id, element: el.outerHTML.substring(0, 100) });
                    } else if (id) {
                        idList.push(id);
                    }
                }
                
                return idList;
            }, config);
            
            // Обрабатываем ID (применяем экстрактор на стороне Node)
            let processedIds = [];
            
            if (config.idExtractor) {
                // Если есть экстрактор, применяем его
                for (const item of ids) {
                    if (typeof item === 'object' && item.raw) {
                        const extracted = config.idExtractor(item.raw);
                        if (extracted) {
                            processedIds.push(extracted);
                        }
                    } else if (typeof item === 'string') {
                        const extracted = config.idExtractor(item);
                        if (extracted) {
                            processedIds.push(extracted);
                        }
                    }
                }
            } else {
                // Просто собираем все строки
                processedIds = ids.filter(id => typeof id === 'string' && id.length > 0);
            }
            
            const newIds = processedIds.filter(id => !allIds.has(id));
            newIds.forEach(id => allIds.add(id));
            
            console.log(`📄 Страница ${pageNumber}: ${newIds.length} новых ID, всего: ${allIds.size}`);
            
            if (newIds.length > 0) {
                console.log(`   📋 ID: ${newIds.slice(0, 10).join(', ')}${newIds.length > 10 ? '...' : ''}`);
            }
            
            // Ждем команду пользователя
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise(resolve => {
                rl.question('⏎ Enter для продолжения или "save" для сохранения: ', resolve);
            });
            rl.close();
            
            if (answer.toLowerCase() === 'save') {
                break;
            }
            
            pageNumber++;
        }
        
        // Сохраняем результат
        const result = Array.from(allIds).sort((a, b) => {
            // Пробуем сортировать как числа, если это возможно
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) {
                return numA - numB;
            }
            return String(a).localeCompare(String(b));
        });
        
        const filename = config.name + '_ids.json';
        fs.writeFileSync(filename, JSON.stringify(result, null, 2));
        
        console.log('\n' + '='.repeat(50));
        console.log('🎉 СБОР ЗАВЕРШЕН!');
        console.log('='.repeat(50));
        console.log(`📊 Всего собрано ID: ${result.length}`);
        console.log(`💾 Результат сохранен в ${filename}`);
        console.log(`📝 Примеры: ${result.slice(0, 5).join(', ')}${result.length > 5 ? '...' : ''}`);
        console.log('='.repeat(50));
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await browser.close();
    }
}

// Главная функция
async function main() {
    try {
        const config = await selectConfig();
        await collectIds(config);
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

// Запуск
main();