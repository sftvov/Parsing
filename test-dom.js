const DOMParser = require('./modules/dom-parser');
const { log } = require('./modules/utils');

function testDOMParser() {
    log('🧪 Тестирование DOM-парсера...', 'info');
    
    const parser = new DOMParser();
    
    // Тестовый HTML
    const testHtml = `
        <html>
            <body>
                <div id="content">
                    <h1 class="title">Тестовая страница</h1>
                    <div class="company">
                        <a href="/company/1" title="ООО Рога и копыта">Компания 1</a>
                        <span class="phone">+7 (999) 123-45-67</span>
                    </div>
                    <div class="company">
                        <a href="/company/2" title="ИП Иванов">Компания 2</a>
                        <span class="email">test@company.com</span>
                    </div>
                    <table id="data">
                        <tr>
                            <th>Название</th>
                            <th>Значение</th>
                        </tr>
                        <tr>
                            <td>Тест 1</td>
                            <td>100</td>
                        </tr>
                        <tr>
                            <td>Тест 2</td>
                            <td>200</td>
                        </tr>
                    </table>
                </div>
            </body>
        </html>
    `;
    
    try {
        // Парсинг HTML
        const document = parser.parseHTML(testHtml);
        
        // Тест 1: Извлечение текста
        log('\n1. Извлечение текста:', 'info');
        const title = parser.extractText('h1.title');
        log(`Заголовок: ${title}`, 'success');
        
        // Тест 2: Извлечение атрибута
        log('\n2. Извлечение атрибутов:', 'info');
        const companyLink = parser.extractAttribute('a[href]', 'href');
        log(`Ссылка: ${companyLink}`, 'success');
        const companyTitle = parser.extractAttribute('a[href]', 'title');
        log(`Название: ${companyTitle}`, 'success');
        
        // Тест 3: Получение элементов
        log('\n3. Получение элементов:', 'info');
        const companies = parser.getElements('.company');
        log(`Найдено компаний: ${companies.length}`, 'success');
        
        // Тест 4: Извлечение таблицы
        log('\n4. Извлечение таблицы:', 'info');
        const tableData = parser.extractTableData('#data', {
            0: 'name',
            1: 'value'
        });
        console.log('Данные таблицы:', JSON.stringify(tableData, null, 2));
        
        // Тест 5: Извлечение ссылок
        log('\n5. Извлечение ссылок:', 'info');
        const links = parser.extractLinks('a', 'https://example.com');
        console.log('Ссылки:', JSON.stringify(links, null, 2));
        
        // Тест 6: Поиск по regex
        log('\n6. Поиск по регулярному выражению:', 'info');
        const emails = parser.findTextByRegex(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        log(`Найденные email: ${emails}`, 'success');
        
        // Тест 7: Работа с контекстом
        log('\n7. Работа с контекстом:', 'info');
        const firstCompany = parser.getElement('.company');
        if (firstCompany) {
            const phoneInCompany = parser.extractText('.phone', firstCompany);
            log(`Телефон в первой компании: ${phoneInCompany}`, 'success');
        }
        
        log('\n✅ Все тесты DOM-парсера пройдены!', 'success');
        
    } catch (error) {
        log(`Ошибка тестирования: ${error.message}`, 'error');
    }
}

// Запуск теста
testDOMParser();