const { log, delay, showProgress } = require('./modules/utils');
const { 
    cleanText, 
    extractEmails, 
    extractPhones, 
    extractWebsites,
    cleanCompanyName 
} = require('./modules/data-cleaner');

// Тестируем утилиты
console.log('🧪 Тестирование модулей...\n');

// Тест 1: Логирование
log('Тестирование системы логирования', 'info');
log('Это ошибка', 'error');
log('Это успех', 'success');
log('Это предупреждение', 'warn');

// Тест 2: Очистка текста
console.log('\n📝 Тестирование очистки текста:');
const testText = '  ООО   "Рога    и    копыта"  ';
console.log('До очистки:', testText);
console.log('После очистки:', cleanText(testText));
console.log('Очистка названия:', cleanCompanyName(testText));

// Тест 3: Извлечение email
console.log('\n📧 Тестирование извлечения email:');
const textWithEmails = 'Контакты: email1@test.com и email2@example.ru, а также test@company.com';
console.log('Текст:', textWithEmails);
console.log('Найденные email:', extractEmails(textWithEmails));

// Тест 4: Извлечение телефонов
console.log('\n📱 Тестирование извлечения телефонов:');
const textWithPhones = 'Телефоны: +7 (999) 123-45-67, 8-800-123-45-67';
console.log('Текст:', textWithPhones);
console.log('Найденные телефоны:', extractPhones(textWithPhones));

// Тест 5: Извлечение сайтов
console.log('\n🌐 Тестирование извлечения сайтов:');
const textWithWebsites = 'Сайты: example.com, https://test.ru, www.company.com';
console.log('Текст:', textWithWebsites);
console.log('Найденные сайты:', extractWebsites(textWithWebsites));

// Тест 6: Прогресс бар
console.log('\n📊 Тестирование прогресс бара:');
let progress = 0;
const interval = setInterval(() => {
    progress += 1;
    showProgress(progress, 10, 'Тест прогресса');
    
    if (progress >= 10) {
        clearInterval(interval);
        console.log('\n✅ Все тесты пройдены успешно!');
    }
}, 100);