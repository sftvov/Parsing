const puppeteer = require('puppeteer');
const fs = require('fs');

async function semiAutoCollectHeatpowerIds() {
    console.log('🚀 Полуавтоматический сбор для heatpower-expo.ru...');
    
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
        await page.goto('https://www.heatpower-expo.ru/ru-RU/about/exhibitor-list.aspx');
        await delay(5000);
        
        // Функция сбора ID
        const collectCurrentIds = async (pageNum) => {
            const ids = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('[data-exib]'))
                    .map(el => el.getAttribute('data-exib'));
            });
            
            ids.forEach(id => allIds.add(id));
            console.log(`✅ Страница ${pageNum}: ${ids.length} карточек, всего: ${allIds.size}`);
            console.log(`   📋 ID: ${ids.join(', ')}`);
            
            return ids;
        };
        
        // Страница 1
        console.log('\n📍 Собираем страницу 1...');
        await collectCurrentIds(1);
        
        console.log('\n📋 ИНСТРУКЦИЯ ДЛЯ ПОЛУАВТОМАТИЧЕСКОГО СБОРА:');
        console.log('==========================================');
        console.log('1. В браузере вручную кликайте на страницы 2, 3, 4...');
        console.log('2. После КАЖДОГО клика возвращайтесь в консоль');
        console.log('3. Нажимайте Enter для сбора ID');
        console.log('4. Когда закончите, введите "done"');
        console.log('==========================================\n');
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        let currentPage = 2;
        
        const askForNextPage = async () => {
            readline.question(`🔄 После перехода на страницу ${currentPage} нажмите Enter (или "done" для завершения)... `, async (answer) => {
                if (answer.toLowerCase() === 'done') {
                    const result = Array.from(allIds).sort((a, b) => a - b);
                    fs.writeFileSync('heatpower_ids_semi.json', JSON.stringify(result, null, 2));
                    
                    console.log('\n🎉 СБОР ЗАВЕРШЕН!');
                    console.log(`📊 Всего ID: ${result.length}`);
                    console.log('💾 Результат в heatpower_ids_semi.json');
                    
                    readline.close();
                    await delay(3000);
                    await browser.close();
                    return;
                }
                
                await collectCurrentIds(currentPage);
                currentPage++;
                console.log(`\n➡️  Перейдите на страницу ${currentPage} в браузере...`);
                askForNextPage();
            });
        };
        
        console.log(`➡️  Перейдите на страницу 2 в браузере...`);
        askForNextPage();
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        await browser.close();
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Для полуавтоматического сбора раскомментируйте:
semiAutoCollectHeatpowerIds();