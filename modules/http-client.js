const axios = require('axios');
const { retry, log, randomDelay } = require('./utils');
const { DEFAULT_HEADERS, DEFAULT_REQUEST_CONFIG } = require('../shared/constants');

/**
 * HTTP клиент для выполнения запросов
 */
class HttpClient {
    constructor(config = {}) {
        this.config = {
            ...DEFAULT_REQUEST_CONFIG,
            headers: { ...DEFAULT_HEADERS, ...config.headers },
            ...config
        };
        
        this.stats = {
            requests: 0,
            errors: 0,
            success: 0
        };
        
        // Настройка axios инстанса
        this.client = axios.create(this.config);
        
        // Интерсепторы для логирования
        this.setupInterceptors();
    }
    
    /**
     * Настройка интерсепторов
     */
    setupInterceptors() {
        // Интерсептор запросов
        this.client.interceptors.request.use(
            (config) => {
                this.stats.requests++;
                log(`➡️  Запрос: ${config.method?.toUpperCase()} ${config.url}`, 'info');
                return config;
            },
            (error) => {
                log(`❌ Ошибка запроса: ${error.message}`, 'error');
                return Promise.reject(error);
            }
        );
        
        // Интерсептор ответов
        this.client.interceptors.response.use(
            (response) => {
                this.stats.success++;
                log(`✅ Ответ: ${response.status} ${response.config.url}`, 'success');
                return response;
            },
            (error) => {
                this.stats.errors++;
                if (error.response) {
                    log(`❌ Ошибка ${error.response.status}: ${error.config.url}`, 'error');
                } else if (error.request) {
                    log(`❌ Нет ответа от сервера: ${error.config.url}`, 'error');
                } else {
                    log(`❌ Ошибка настройки: ${error.message}`, 'error');
                }
                return Promise.reject(error);
            }
        );
    }
    
    /**
     * Выполнение GET запроса с повторными попытками
     * @param {string} url - URL для запроса
     * @param {object} options - дополнительные опции
     * @returns {Promise<string>} HTML контент
     */
    async fetchPage(url, options = {}) {
        const fetchFn = async () => {
            const response = await this.client.get(url, {
                ...options,
                timeout: options.timeout || 15000
            });
            return response.data;
        };
        
        return retry(fetchFn, options.retries || 3, options.retryDelay || 2000);
    }
    
    /**
     * Выполнение GET запроса с задержкой
     * @param {string} url - URL для запроса
     * @param {number} delayMs - задержка перед запросом
     * @param {object} options - дополнительные опции
     * @returns {Promise<string>} HTML контент
     */
    async fetchWithDelay(url, delayMs = 1000, options = {}) {
        await randomDelay(delayMs, delayMs + 1000);
        return this.fetchPage(url, options);
    }
    
    /**
     * Выполнение нескольких запросов с контролируемой скоростью
     * @param {Array<string>} urls - массив URL
     * @param {number} delayBetweenRequests - задержка между запросами
     * @param {number} concurrency - количество одновременных запросов
     * @returns {Promise<Array>} массив результатов
     */
    async fetchAll(urls, delayBetweenRequests = 1000, concurrency = 1) {
        const results = [];
        const queue = [...urls];
        
        async function worker() {
            while (queue.length > 0) {
                const url = queue.shift();
                try {
                    const content = await this.fetchWithDelay(url, delayBetweenRequests);
                    results.push({ url, success: true, data: content });
                } catch (error) {
                    results.push({ url, success: false, error: error.message });
                }
            }
        }
        
        // Запускаем workers
        const workers = [];
        for (let i = 0; i < Math.min(concurrency, urls.length); i++) {
            workers.push(worker.call(this));
        }
        
        await Promise.all(workers);
        return results;
    }
    
    /**
     * Получение статистики запросов
     * @returns {object} статистика
     */
    getStats() {
        return {
            ...this.stats,
            successRate: this.stats.requests > 0 
                ? (this.stats.success / this.stats.requests * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Сброс статистики
     */
    resetStats() {
        this.stats = { requests: 0, errors: 0, success: 0 };
    }
}

module.exports = HttpClient;