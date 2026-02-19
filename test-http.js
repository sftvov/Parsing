const HttpClient = require('./modules/http-client');
const { log } = require('./modules/utils');

async function testHttpClient() {
    log('🧪 Тестирование HTTP-клиента...', 'info');
    
    const httpClient = new HttpClient();
    
    try {
        // Тест 1: Простой запрос
        log('\n1. Тест простого запроса:', 'info');
        const html = await httpClient.fetchPage('https://httpbin.org/html');
        log(`Получено ${html.length} байт`, 'success');
        
        // Тест 2: Запрос с задержкой
        log('\n2. Тест запроса с задержкой:', 'info');
        const delayedHtml = await httpClient.fetchWithDelay('https://httpbin.org/get', 1000);
        log(`Получено ${delayedHtml.length} байт с задержкой`, 'success');
        
        // Тест 3: Статистика
        log('\n3. Статистика запросов:', 'info');
        const stats = httpClient.getStats();
        console.log('Статистика:', stats);
        
        // Тест 4: Несколько запросов
        log('\n4. Тест нескольких запросов:', 'info');
        const urls = [
            'https://httpbin.org/status/200',
            'https://httpbin.org/status/404',
            'https://httpbin.org/status/500'
        ];
        
        const results = await httpClient.fetchAll(urls, 500, 2);
        
        results.forEach((result, index) => {
            if (result.success) {
                log(`Запрос ${index + 1} успешен`, 'success');
            } else {
                log(`Запрос ${index + 1} неудачен: ${result.error}`, 'error');
            }
        });
        
        // Финальная статистика
        log('\n📊 Финальная статистика:', 'info');
        const finalStats = httpClient.getStats();
        console.log(finalStats);
        
    } catch (error) {
        log(`Ошибка тестирования: ${error.message}`, 'error');
    }
}

// Запуск теста
testHttpClient();