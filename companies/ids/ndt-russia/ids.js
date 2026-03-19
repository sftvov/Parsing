const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');

// Функция задержки
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function semiAutoNdtRussia() {
    console.log('🚀 Полуавтоматический сбор для ndt-russia.ru...');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized']
    });
    
    const page = await browser.newPage();
    const allIds = new Set();
    
    try {
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        
        console.log('📥 Загружаем страницу...');
        await page.goto('https://www.ndt-russia.ru/ru-RU/about/exhibitor-list.aspx');
        await delay(5000);
        
        // Функция сбора ID
        const collectCurrentIds = async (pageNum) => {
            const ids = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('[data-exib]'))
                    .map(el => el.getAttribute('data-exib'));
            });
            
            const newIds = ids.filter(id => !allIds.has(id));
            ids.forEach(id => allIds.add(id));
            
            console.log(`✅ Страница ${pageNum}: ${ids.length} карточек, новых: ${newIds.length}, всего: ${allIds.size}`);
            
            if (newIds.length > 0) {
                console.log(`   📋 Новые ID: ${newIds.join(', ')}`);
            } else {
                console.log('   ⚠️  Новых ID нет!');
            }
            
            return ids;
        };
        
        // Страница 1
        console.log('\n📍 Собираем страницу 1...');
        await collectCurrentIds(1);
        
        console.log('\n📋 ИНСТРУКЦИЯ:');
        console.log('==============');
        console.log('1. В браузере ВРУЧНУЮ кликните на страницу 2');
        console.log('2. Подождите полной загрузки (должна стать активной страница 2)');
        console.log('3. Вернитесь в консоль и нажмите Enter');
        console.log('4. Повторите для страницы 3');
        console.log('5. В конце введите "done"');
        console.log('==============\n');
        
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        let currentPage = 2;
        const totalPages = 3; // Всего 3 страницы на сайте
        
        const askForNextPage = async () => {
            rl.question(`🔄 После перехода на страницу ${currentPage} нажмите Enter ("done" для завершения)... `, async (answer) => {
                if (answer.toLowerCase() === 'done') {
                    // Сохраняем результат при вводе "done"
                    saveAndExit();
                    return;
                }
                
                await collectCurrentIds(currentPage);
                currentPage++;
                
                if (currentPage <= totalPages) {
                    console.log(`\n➡️  Перейдите на страницу ${currentPage} в браузере...`);
                    askForNextPage();
                } else {
                    // Сохраняем результат когда все страницы обработаны
                    console.log('\n✅ Все страницы обработаны! Сохраняем результат...');
                    saveAndExit();
                }
            });
        };
        
        // Функция для сохранения и выхода
        const saveAndExit = async () => {
            const result = Array.from(allIds).sort((a, b) => a - b);
            const filename = 'ndt_russia_ids.json';
            
            fs.writeFileSync(filename, JSON.stringify(result, null, 2));
            
            console.log('\n🎉 СБОР ЗАВЕРШЕН!');
            console.log(`📊 Всего собрано ID: ${result.length}`);
            console.log(`💾 Результат сохранен в ${filename}`);
            console.log('📋 Все ID:', result);
            
            rl.close();
            await delay(3000);
            await browser.close();
            process.exit(0); // Завершаем процесс
        };
        
        console.log(`➡️  Перейдите на страницу ${currentPage} в браузере...`);
        askForNextPage();
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await browser.close();
    }
}

// Запуск
semiAutoNdtRussia();