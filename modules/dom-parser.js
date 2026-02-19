const { JSDOM } = require('jsdom');
const { log } = require('./utils');
const { normalizeUrl } = require('./data-cleaner');

/**
 * DOM парсер для извлечения данных из HTML
 */
class DOMParser {
    constructor() {
        this.document = null;
    }
    
    /**
     * Парсинг HTML в DOM и сохранение в свойстве
     * @param {string} html - HTML контент
     * @returns {Document} DOM документ
     */
    parseHTML(html) {
        try {
            const dom = new JSDOM(html);
            this.document = dom.window.document;
            return this.document;
        } catch (error) {
            log(`Ошибка парсинга HTML: ${error.message}`, 'error');
            throw error;
        }
    }
    
    /**
     * Извлечение текста по селектору
     * @param {string} selector - CSS селектор
     * @param {Element} context - контекстный элемент (опционально)
     * @returns {string} извлеченный текст
     */
    extractText(selector, context = null) {
        const element = this.getElement(selector, context);
        return element ? element.textContent.trim() : '';
    }
    
    /**
     * Извлечение атрибута по селектору
     * @param {string} selector - CSS селектор
     * @param {string} attribute - имя атрибута
     * @param {Element} context - контекстный элемент (опционально)
     * @returns {string} значение атрибута
     */
    extractAttribute(selector, attribute, context = null) {
        const element = this.getElement(selector, context);
        return element ? element.getAttribute(attribute) || '' : '';
    }
    
    /**
     * Получение элемента по селектору
     * @param {string} selector - CSS селектор
     * @param {Element} context - контекстный элемент (опционально)
     * @returns {Element|null} найденный элемент
     */
    getElement(selector, context = null) {
        try {
            const searchContext = context || this.document;
            if (!searchContext) {
                log(`Контекст не установлен для селектора: ${selector}`, 'warn');
                return null;
            }
            
            return searchContext.querySelector(selector);
        } catch (error) {
            log(`Ошибка поиска элемента ${selector}: ${error.message}`, 'error');
            return null;
        }
    }
    
    /**
     * Получение всех элементов по селектору
     * @param {string} selector - CSS селектор
     * @param {Element} context - контекстный элемент (опционально)
     * @returns {Array<Element>} массив элементов
     */
    getElements(selector, context = null) {
        try {
            const searchContext = context || this.document;
            if (!searchContext) {
                log(`Контекст не установлен для селектора: ${selector}`, 'warn');
                return [];
            }
            
            return Array.from(searchContext.querySelectorAll(selector));
        } catch (error) {
            log(`Ошибка поиска элементов ${selector}: ${error.message}`, 'error');
            return [];
        }
    }
    
    /**
     * Извлечение данных из таблицы
     * @param {string} tableSelector - селектор таблицы
     * @param {object} columnMap - маппинг колонок
     * @param {Element} context - контекстный элемент (опционально)
     * @returns {Array<object>} данные таблицы
     */
    extractTableData(tableSelector, columnMap, context = null) {
        const table = this.getElement(tableSelector, context);
        if (!table) return [];
        
        const rows = table.querySelectorAll('tr');
        const data = [];
        
        rows.forEach(row => {
            const rowData = {};
            const cells = row.querySelectorAll('td, th');
            
            cells.forEach((cell, index) => {
                const columnName = columnMap[index];
                if (columnName) {
                    rowData[columnName] = cell.textContent.trim();
                }
            });
            
            if (Object.keys(rowData).length > 0) {
                data.push(rowData);
            }
        });
        
        return data;
    }
    
    /**
     * Извлечение ссылок из элементов
     * @param {string} selector - селектор элементов с ссылками
     * @param {string} baseUrl - базовый URL для нормализации
     * @param {Element} context - контекстный элемент (опционально)
     * @returns {Array<object>} массив объектов {text, url}
     */
    extractLinks(selector, baseUrl = '', context = null) {
        const elements = this.getElements(selector, context);
        return elements.map(element => {
            const text = element.textContent.trim();
            const href = element.getAttribute('href') || '';
            const url = href ? normalizeUrl(href, baseUrl) : '';
            
            return { text, url };
        }).filter(link => link.url); // Фильтруем пустые ссылки
    }
    
    /**
     * Извлечение пагинации
     * @param {object} selectors - селекторы для пагинации
     * @param {Element} context - контекстный элемент (опционально)
     * @returns {object} информация о пагинации
     */
    extractPagination(selectors = {}, context = null) {
        const result = {
            currentPage: 1,
            totalPages: 1,
            hasNext: false,
            nextUrl: ''
        };
        
        // Определение текущей страницы
        if (selectors.currentPage) {
            const currentPageText = this.extractText(selectors.currentPage, context);
            const pageMatch = currentPageText.match(/\d+/);
            if (pageMatch) {
                result.currentPage = parseInt(pageMatch[0], 10);
            }
        }
        
        // Определение общего количества страниц
        if (selectors.totalPages) {
            const totalPagesText = this.extractText(selectors.totalPages, context);
            const totalMatch = totalPagesText.match(/\d+/);
            if (totalMatch) {
                result.totalPages = parseInt(totalMatch[0], 10);
            }
        }
        
        // Проверка наличия следующей страницы
        if (selectors.nextButton) {
            const nextButton = this.getElement(selectors.nextButton, context);
            if (nextButton && !nextButton.hasAttribute('disabled')) {
                result.hasNext = true;
                result.nextUrl = nextButton.getAttribute('href') || '';
            }
        }
        
        return result;
    }
    
    /**
     * Поиск текста по регулярному выражению
     * @param {RegExp} regex - регулярное выражение
     * @param {Element} context - контекстный элемент (опционально)
     * @returns {Array} найденные совпадения
     */
    findTextByRegex(regex, context = null) {
        const searchContext = context || this.document;
        if (!searchContext) {
            log('Контекст не установлен для поиска по regex', 'warn');
            return [];
        }
        
        const text = searchContext.textContent || searchContext.body?.textContent || '';
        const matches = text.match(regex);
        return matches || [];
    }
    
    /**
     * Очистка текущего документа
     */
    clear() {
        this.document = null;
    }
}

module.exports = DOMParser;