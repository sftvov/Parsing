const puppeteer = require('puppeteer');
const fs = require('fs');

async function collectCleanExpoIdsSimple() {
    console.log('🚀 Упрощенный сбор для cleanexpo-moscow.ru...');
    
    const browser = await puppeteer.launch({ 
        headless: false,
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    const allIds = new Set();
    
    try {
        await page.goto('https://www.cleanexpo-moscow.ru/ru-RU/about/exhibitor-list.aspx', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        await page.waitForSelector('.participant_block', { timeout: 10000 });
        
        console.log('📋 ИНСТРУКЦИЯ:');
        console.log('==============');
        console.log('1. Скрипт будет собирать ID с каждой страницы');
        console.log('2. ВРУЧНУЕ переходите по страницам в браузере');
        console.log('3. После каждого перехода нажмите Enter в консоли');
        console.log('4. Для завершения введите "save"');
        console.log('==============\n');
        
        let pageNumber = 1;
        
        while (true) {
            // Собираем ID с текущей страницы
            const ids = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.participant_block [data-exib]'))
                    .map(el => el.getAttribute('data-exib'))
                    .filter(id => id && id.length > 0);
            });
            
            const newIds = ids.filter(id => !allIds.has(id));
            ids.forEach(id => allIds.add(id));
            
            console.log(`📄 Страница ${pageNumber}: ${newIds.length} новых ID, всего: ${allIds.size}`);
            
            if (newIds.length > 0) {
                console.log(`   📋 ID: ${newIds.join(', ')}`);
            }
            
            // Ждем команду пользователя
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise(resolve => {
                rl.question('Нажмите Enter для продолжения или введите "save" для сохранения: ', resolve);
            });
            rl.close();
            
            if (answer.toLowerCase() === 'save') {
                break;
            }
            
            pageNumber++;
        }
        
        // Сохраняем результат
        const result = Array.from(allIds).sort((a, b) => a - b);
        const filename = 'cleanexpo_ids.json';
        
        fs.writeFileSync(filename, JSON.stringify(result, null, 2));
        
        console.log('\n🎉 СБОР ЗАВЕРШЕН!');
        console.log(`📊 Всего собрано ID: ${result.length}`);
        console.log(`💾 Результат сохранен в ${filename}`);
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await browser.close();
    }
}

collectCleanExpoIdsSimple();