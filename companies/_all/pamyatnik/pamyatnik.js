const axios = require('axios');
const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const mainLink = 'https://pamyatnik-spb.ru/gorizontalnye_pamyatniki/';
const pagination = '?page=';
const pages = 3;
const category = 'gorizontalnye';

// Делаем функцию асинхронной
async function parsing() {
    let allProductsData = []; // Массив для всех товаров

    // Используем цикл for...of для итерации и await внутри него
    for (let currentPage = 1; currentPage <= pages; currentPage++) {
        const currentLink = mainLink + pagination + currentPage;

        try {
            // Ожидаем ответа от сервера
            const response = await axios.get(currentLink);
            const dom = new JSDOM(response.data);
            const products = dom.window.document.querySelectorAll('.product-thumb');

            // Обрабатываем каждый товар на странице
            for (const product of products) {
                let productData = [];
                
                const name = product.querySelector('.caption a').textContent;
                productData.push(name);
                
                const price = product.querySelector('.price').textContent.trim();
                productData.push(price);
                
                const img = product.querySelector('.image img').src;
                productData.push(img);
                
                productData.push(3); // Stock
                productData.push(category); // Categories
                
                allProductsData.push(productData); // Добавляем товар в общий массив
            }

            console.log(`Страница ${currentPage} обработана.`);

        } catch (error) {
            // Обрабатываем возможные ошибки запроса (например, 404)
            console.error(`Ошибка при загрузке страницы ${currentPage}:`, error.message);
        }
    }

    // После обработки ВСЕХ страниц формируем и записываем CSV файл ОДИН РАЗ
    let csvHeader = 'Name,Regular price,Images,Stock,Categories\n';
    // Экранируем кавычки и сами данные, чтобы избежать проблем с запятыми в названиях
    const csvRows = allProductsData.map(row => 
        row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const finalCsv = csvHeader + csvRows;
    
    fs.writeFileSync('pam.csv', finalCsv, 'utf8');
    console.log('Готово! Все данные сохранены в pam.csv');
}

// Запускаем парсинг
parsing();