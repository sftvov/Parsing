const axios = require('axios');
const { JSDOM } = require('jsdom');

const BASE_URL = 'https://www.cntiprogress.ru/seminars/rubrics/default.aspx';

async function parseCategoriesWithSubcategories() {
    try {
        console.log('Начинаем парсинг категорий с подкатегориями...');
        
        // Получаем главную страницу с категориями
        const response = await axios.get(BASE_URL, { timeout: 15000 });
        const dom = new JSDOM(response.data);
        const document = dom.window.document;

        // Находим блок с очными курсами
        const ochnoBlock = document.querySelector('#ochno_sub');
        if (!ochnoBlock) {
            console.log('Не найден блок с категориями');
            return;
        }

        // Находим все ссылки на категории
        const categoryLinks = ochnoBlock.querySelectorAll('.Catalog-list1 li a');
        console.log(`Найдено категорий: ${categoryLinks.length}`);

        const results = [];

        // Обрабатываем каждую категорию
        for (let i = 0; i < categoryLinks.length; i++) {
            const link = categoryLinks[i];
            const categoryName = link.textContent.trim();
            const categoryUrl = link.href;

            console.log(`\nОбрабатываем категорию [${i + 1}/${categoryLinks.length}]: ${categoryName}`);

            try {
                // Переходим на страницу категории
                const categoryResponse = await axios.get(categoryUrl, { timeout: 15000 });
                const categoryDom = new JSDOM(categoryResponse.data);
                const categoryDocument = categoryDom.window.document;

                // Проверяем наличие подкатегорий
                const subcategoriesList = categoryDocument.querySelector('ul.list_of_sub');
                
                if (subcategoriesList) {
                    console.log('  ✓ Найдены подкатегории');
                    
                    const subcategories = [];
                    const subcategoryLinks = subcategoriesList.querySelectorAll('li a');
                    
                    subcategoryLinks.forEach(subLink => {
                        subcategories.push({
                            name: subLink.textContent.trim(),
                            url: subLink.href
                        });
                    });

                    results.push({
                        category: categoryName,
                        categoryUrl: categoryUrl,
                        subcategories: subcategories
                    });

                    console.log(`  Количество подкатегорий: ${subcategories.length}`);
                    subcategories.forEach((sub, index) => {
                        console.log(`    ${index + 1}. ${sub.name}`);
                    });
                } else {
                    console.log('  ✗ Нет подкатегорий');
                }

                // Задержка между запросами
                await delay(1000);

            } catch (error) {
                console.error(`  Ошибка при обработке категории ${categoryName}:`, error.message);
            }
        }

        // Выводим итоговые результаты
        console.log('\n' + '='.repeat(50));
        console.log('ИТОГИ:');
        console.log('='.repeat(50));
        
        console.log(`Всего категорий обработано: ${categoryLinks.length}`);
        console.log(`Категорий с подкатегориями: ${results.length}`);
        console.log(`Категорий без подкатегорий: ${categoryLinks.length - results.length}`);

        console.log('\nКАТЕГОРИИ С ПОДКАТЕГОРИЯМИ:');
        console.log('='.repeat(50));

        results.forEach((result, index) => {
            console.log(`\n${index + 1}. ${result.category}`);
            console.log(`   URL: ${result.categoryUrl}`);
            console.log(`   Подкатегории (${result.subcategories.length}):`);
            
            result.subcategories.forEach((sub, subIndex) => {
                console.log(`     ${subIndex + 1}. ${sub.name}`);
                console.log(`        ${sub.url}`);
            });
        });

        // Сохраняем результаты в файл
        saveResultsToFile(results);

    } catch (error) {
        console.error('Произошла ошибка:', error.message);
    }
}

// Функция для сохранения результатов в файл
function saveResultsToFile(results) {
    const fs = require('fs');
    
    // Сохраняем в JSON
    const jsonData = JSON.stringify(results, null, 2);
    fs.writeFileSync('categories_with_subcategories.json', jsonData, 'utf8');
    console.log('\nРезультаты сохранены в categories_with_subcategories.json');

    // Сохраняем в текстовый файл
    let textData = 'КАТЕГОРИИ С ПОДКАТЕГОРИЯМИ\n';
    textData += '='.repeat(50) + '\n\n';
    
    results.forEach((result, index) => {
        textData += `${index + 1}. ${result.category}\n`;
        textData += `   URL: ${result.categoryUrl}\n`;
        textData += `   Подкатегории (${result.subcategories.length}):\n`;
        
        result.subcategories.forEach((sub, subIndex) => {
            textData += `     ${subIndex + 1}. ${sub.name}\n`;
            textData += `        ${sub.url}\n`;
        });
        textData += '\n';
    });

    fs.writeFileSync('categories_with_subcategories.txt', textData, 'utf8');
    console.log('Результаты сохранены в categories_with_subcategories.txt');

    // Сохраняем в CSV
    let csvData = 'Категория;URL категории;Подкатегория;URL подкатегории\n';
    
    results.forEach(result => {
        if (result.subcategories.length > 0) {
            result.subcategories.forEach(sub => {
                csvData += `"${result.category}";"${result.categoryUrl}";"${sub.name}";"${sub.url}"\n`;
            });
        } else {
            csvData += `"${result.category}";"${result.categoryUrl}";"";""\n`;
        }
    });

    fs.writeFileSync('categories_with_subcategories.csv', csvData, 'utf8');
    console.log('Результаты сохранены в categories_with_subcategories.csv');
}

// Вспомогательная функция для задержки
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Запускаем парсинг
parseCategoriesWithSubcategories();