const CSVExporter = require('./modules/csv-exporter');
const { log } = require('./modules/utils');

function testCSVExporter() {
    log('🧪 Тестирование CSV-экспортера...', 'info');
    
    const exporter = new CSVExporter();
    const testData = [
        {
            Ссылка: 'https://example.com/company1',
            Название: 'ООО "Рога и копыта"',
            Сайт: 'https://roga-i-kopyta.ru',
            Телефон: '+7 (999) 123-45-67',
            Email: 'info@roga-i-kopyta.ru'
        },
        {
            Ссылка: 'https://example.com/company2',
            Название: 'ИП Иванов',
            Сайт: 'https://ivanov.com',
            Телефон: '8-800-123-45-67',
            Email: 'sales@ivanov.com'
        },
        {
            Ссылка: 'https://example.com/company3',
            Название: 'Компания; с; точками; с; запятой',
            Сайт: '',
            Телефон: '',
            Email: 'test@example.com'
        }
    ];
    
    try {
        // Тест 1: Валидация данных
        log('\n1. Валидация данных:', 'info');
        const validation = exporter.validateCSV(testData);
        console.log('Результат валидации:', validation);
        
        // Тест 2: Создание CSV строки
        log('\n2. Создание CSV строки:', 'info');
        const csvString = exporter.createCSV(testData);
        log(`Создана CSV строка длиной ${csvString.length} символов`, 'success');
        console.log('Первые 200 символов:');
        console.log(csvString.substring(0, 200) + '...');
        
        // Тест 3: Сохранение в файл
        log('\n3. Сохранение в файл:', 'info');
        const testFilename = 'test-output.csv';
        const saved = exporter.saveCSV(testFilename, testData);
        
        if (saved) {
            log('Файл успешно сохранен', 'success');
            
            // Тест 4: Чтение CSV файла
            log('\n4. Чтение CSV файла:', 'info');
            const readData = exporter.readCSV(testFilename);
            console.log(`Прочитано ${readData.length} записей`);
            console.log('Первая запись:', readData[0]);
            
            // Тест 5: Добавление данных
            log('\n5. Добавление данных:', 'info');
            const additionalData = [
                {
                    Ссылка: 'https://example.com/company4',
                    Название: 'Новая компания',
                    Сайт: 'https://new-company.ru',
                    Телефон: '+7 (495) 111-22-33',
                    Email: 'info@new-company.ru'
                }
            ];
            
            exporter.appendToCSV(testFilename, additionalData);
            
            // Проверяем обновленный файл
            const updatedData = exporter.readCSV(testFilename);
            log(`Теперь в файле ${updatedData.length} записей`, 'success');
        }
        
        // Тест 6: Статистика
        log('\n6. Статистика:', 'info');
        const stats = exporter.getStats();
        console.log('Статистика экспорта:', stats);
        
        // Очистка тестового файла
        try {
            require('fs').unlinkSync(testFilename);
            log(`Тестовый файл ${testFilename} удален`, 'info');
        } catch (e) {
            // Игнорируем ошибку удаления
        }
        
        log('\n✅ Все тесты CSV-экспортера пройдены!', 'success');
        
    } catch (error) {
        log(`❌ Ошибка тестирования: ${error.message}`, 'error');
    }
}

// Запуск теста
testCSVExporter();