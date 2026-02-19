const puppeteer = require('puppeteer');
const fs = require('fs');

async function autoCollectFasttecIds() {
    console.log('🚀 Автоматический сбор для fasttec.ru...');
    
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
        await page.goto('https://www.fasttec.ru/ru-RU/about/exhibitor-list.aspx', {
            waitUntil: 'networkidle2'
        });

        await delay(5000);
        
        // Функция сбора ID
        const collectIds = async (pageNum) => {
            const ids = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a[data-item]'))
                    .map(el => el.getAttribute('data-item'))
                    .filter(id => id);
            });
            
            ids.forEach(id => allIds.add(id));
            console.log(`📄 Страница ${pageNum}: ${ids.length} карточек`);
            return ids;
        };
        
        // Страница 1
        await collectIds(1);
        
        // Автоматически кликаем по страницам
        const totalPages = await page.evaluate(() => {
            return document.querySelectorAll('.pagination .page-item').length;
        });
        
        console.log(`📊 Всего страниц в пагинации: ${totalPages}`);
        
        for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
            console.log(`\n🔄 Переход на страницу ${pageNum}...`);
            
            try {
                // Кликаем на страницу через JavaScript
                const clickSuccess = await page.evaluate((pageNumber) => {
                    const pageLinks = document.querySelectorAll('.pagination .page-link');
                    for (let link of pageLinks) {
                        if (link.textContent.trim() === pageNumber.toString()) {
                            const href = link.getAttribute('href');
                            if (href && href.includes('__doPostBack')) {
                                // Вызываем __doPostBack напрямую
                                const match = href.match(/__doPostBack\('([^']+)','([^']+)'\)/);
                                if (match) {
                                    __doPostBack(match[1], match[2]);
                                    return true;
                                }
                            } else {
                                link.click();
                                return true;
                            }
                        }
                    }
                    return false;
                }, pageNum);
                
                if (clickSuccess) {
                    console.log('   ✅ Клик выполнен');
                    await delay(5000); // Ждем загрузки
                    
                    // Проверяем загрузились ли карточки
                    const cardsCount = await page.evaluate(() => {
                        return document.querySelectorAll('a[data-item]').length;
                    });
                    
                    if (cardsCount > 0) {
                        await collectIds(pageNum);
                    } else {
                        console.log('   ⚠️  Карточки не загрузились');
                    }
                } else {
                    console.log('   ❌ Не удалось найти кнопку страницы');
                }
                
            } catch (error) {
                console.log(`   ❌ Ошибка: ${error.message}`);
            }
        }
        
        // Результат
        const result = Array.from(allIds).sort((a, b) => a - b);
        fs.writeFileSync('fasttec_auto_ids.json', JSON.stringify(result, null, 2));
        
        console.log('\n🎉 АВТОМАТИЧЕСКИЙ СБОР ЗАВЕРШЕН!');
        console.log(`📊 Всего ID: ${result.length}`);
        console.log('💾 Результат в fasttec_auto_ids.json');
        
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    } finally {
        await delay(5000);
        await browser.close();
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Для автоматического сбора раскомментируйте:
// autoCollectFasttecIds();

// Для полуавтоматического сбора:
autoCollectFasttecIds();