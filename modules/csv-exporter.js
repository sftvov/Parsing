const fs = require('fs');
const iconv = require('iconv-lite');
const { log } = require('./utils');
const { CSV_CONFIG } = require('../shared/constants');

/**
 * CSV экспортер для сохранения данных
 */
class CSVExporter {
    constructor(config = {}) {
        this.config = {
            ...CSV_CONFIG,
            ...config
        };
        
        this.stats = {
            exported: 0,
            errors: 0
        };
    }
    
    /**
     * Создание CSV строки из массива объектов
     * @param {Array<object>} data - данные для экспорта
     * @param {Array<string>} columns - порядок колонок
     * @returns {string} CSV строка
     */
    createCSV(data, columns = null) {
        if (!data || data.length === 0) {
            log('Нет данных для экспорта в CSV', 'warn');
            return '';
        }
        
        // Определяем колонки, если не указаны
        const columnNames = columns || Object.keys(data[0]);
        
        // Создаем заголовок
        let csv = columnNames.join(this.config.delimiter) + '\n';
        
        // Добавляем данные
        data.forEach(row => {
            const rowValues = columnNames.map(column => {
                let value = row[column] || '';
                
                // Экранируем кавычки и спецсимволы
                if (typeof value === 'string') {
                    value = value.replace(/"/g, '""');
                    if (value.includes(this.config.delimiter) || value.includes('\n') || value.includes('"')) {
                        value = `"${value}"`;
                    }
                }
                
                return value;
            });
            
            csv += rowValues.join(this.config.delimiter) + '\n';
        });
        
        return csv;
    }
    
    /**
     * Сохранение CSV в файл
     * @param {string} filename - имя файла
     * @param {string|Array<object>} data - данные для сохранения
     * @param {object} options - дополнительные опции
     * @returns {boolean} успешность сохранения
     */
    saveCSV(filename, data, options = {}) {
        try {
            log(`💾 Сохранение CSV в ${filename}...`, 'info');
            
            // Если данные - массив объектов, конвертируем в CSV
            let csvContent;
            if (Array.isArray(data)) {
                csvContent = this.createCSV(data, options.columns);
                this.stats.exported = data.length;
            } else {
                csvContent = data;
            }
            
            // Определяем кодировку
            const encoding = options.encoding || this.config.encoding;
            
            // Сохраняем файл
            if (encoding === 'win1251') {
                const buffer = iconv.encode(csvContent, 'win1251');
                fs.writeFileSync(filename, buffer);
            } else {
                fs.writeFileSync(filename, csvContent, encoding || 'utf8');
            }
            
            const fileSize = (fs.statSync(filename).size / 1024).toFixed(2);
            log(`✅ CSV сохранен: ${filename} (${fileSize} KB)`, 'success');
            
            return true;
            
        } catch (error) {
            this.stats.errors++;
            log(`❌ Ошибка сохранения CSV: ${error.message}`, 'error');
            return false;
        }
    }
    
    /**
     * Добавление данных в существующий CSV файл
     * @param {string} filename - имя файла
     * @param {Array<object>} data - данные для добавления
     * @param {object} options - дополнительные опции
     * @returns {boolean} успешность добавления
     */
    appendToCSV(filename, data, options = {}) {
        try {
            log(`➕ Добавление ${data.length} записей в ${filename}...`, 'info');
            
            // Проверяем, существует ли файл
            const fileExists = fs.existsSync(filename);
            
            let csvContent;
            if (!fileExists) {
                // Создаем новый файл с заголовком
                csvContent = this.createCSV(data, options.columns);
            } else {
                // Читаем существующий файл и добавляем данные
                const existingContent = fs.readFileSync(filename, 'utf8');
                const dataRows = this.createCSV(data, options.columns);
                
                // Убираем заголовок из новых данных, если он есть
                const rows = dataRows.split('\n');
                const dataWithoutHeader = rows.length > 1 ? rows.slice(1).join('\n') : '';
                
                csvContent = existingContent.trim() + '\n' + dataWithoutHeader;
            }
            
            // Сохраняем обновленный файл
            return this.saveCSV(filename, csvContent, options);
            
        } catch (error) {
            log(`❌ Ошибка добавления в CSV: ${error.message}`, 'error');
            return false;
        }
    }
    
    /**
     * Валидация данных перед экспортом
     * @param {Array<object>} data - данные для валидации
     * @returns {object} результат валидации
     */
    validateCSV(data) {
        if (!Array.isArray(data) || data.length === 0) {
            return { valid: false, errors: ['Нет данных для экспорта'] };
        }
        
        const errors = [];
        const sample = data[0];
        const expectedColumns = this.config.columns || Object.keys(sample);
        
        // Проверяем, что все объекты имеют одинаковую структуру
        data.forEach((row, index) => {
            const rowColumns = Object.keys(row);
            
            // Проверяем наличие обязательных колонок
            expectedColumns.forEach(column => {
                if (!rowColumns.includes(column)) {
                    errors.push(`Строка ${index + 1}: отсутствует колонка "${column}"`);
                }
            });
            
            // Проверяем типы данных
            Object.entries(row).forEach(([key, value]) => {
                if (typeof value === 'object' && value !== null) {
                    errors.push(`Строка ${index + 1}: колонка "${key}" содержит объект вместо строки`);
                }
            });
        });
        
        return {
            valid: errors.length === 0,
            errors,
            stats: {
                totalRows: data.length,
                totalColumns: expectedColumns.length,
                sampleColumns: Object.keys(sample)
            }
        };
    }
    
    /**
     * Получение статистики экспорта
     * @returns {object} статистика
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Чтение CSV файла
     * @param {string} filename - имя файла
     * @param {object} options - опции чтения
     * @returns {Array<object>} данные из CSV
     */
    readCSV(filename, options = {}) {
        try {
            if (!fs.existsSync(filename)) {
                log(`Файл ${filename} не существует`, 'warn');
                return [];
            }
            
            const encoding = options.encoding || this.config.encoding;
            let content;
            
            if (encoding === 'win1251') {
                const buffer = fs.readFileSync(filename);
                content = iconv.decode(buffer, 'win1251');
            } else {
                content = fs.readFileSync(filename, encoding || 'utf8');
            }
            
            const lines = content.trim().split('\n');
            if (lines.length < 2) return [];
            
            // Парсим заголовок
            const headers = lines[0].split(this.config.delimiter)
                .map(header => header.trim().replace(/^"|"$/g, ''));
            
            // Парсим данные
            const data = [];
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const values = this.parseCSVLine(line, headers.length);
                const row = {};
                
                headers.forEach((header, index) => {
                    let value = values[index] || '';
                    // Убираем кавычки
                    if (value.startsWith('"') && value.endsWith('"')) {
                        value = value.slice(1, -1).replace(/""/g, '"');
                    }
                    row[header] = value;
                });
                
                data.push(row);
            }
            
            log(`📖 Прочитано ${data.length} записей из ${filename}`, 'success');
            return data;
            
        } catch (error) {
            log(`❌ Ошибка чтения CSV: ${error.message}`, 'error');
            return [];
        }
    }
    
    /**
     * Парсинг строки CSV с учетом кавычек
     * @param {string} line - строка CSV
     * @param {number} expectedColumns - ожидаемое количество колонок
     * @returns {Array<string>} значения колонок
     */
    parseCSVLine(line, expectedColumns) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];
            
            if (char === '"' && nextChar === '"') {
                current += '"';
                i++; // Пропускаем следующую кавычку
            } else if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === this.config.delimiter && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current);
        
        // Если колонок меньше, чем ожидалось, добавляем пустые
        while (result.length < expectedColumns) {
            result.push('');
        }
        
        return result;
    }
}

module.exports = CSVExporter;