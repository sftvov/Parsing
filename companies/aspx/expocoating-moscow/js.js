// Сохраняем ID в localStorage перед перезагрузкой
function collectAllIdsWithStorage() {
    console.log('💾 Используем localStorage для сохранения данных...');
    
    const allIds = new Set();
    const pagination = document.querySelector('.pagination');
    const pageButtons = Array.from(pagination.querySelectorAll('a'));
    
    // Собираем текущую страницу
    const currentCards = document.querySelectorAll('[data-exib]');
    currentCards.forEach(card => allIds.add(card.getAttribute('data-exib')));
    
    // Сохраняем в localStorage
    const savedData = {
        ids: Array.from(allIds),
        currentPage: 1,
        totalPages: pageButtons.length + 1,
        processedPages: [1]
    };
    
    localStorage.setItem('exhibitorCollection', JSON.stringify(savedData));
    console.log('💾 Сохранены данные страницы 1:', savedData.ids);
    
    console.log('\n📋 ИНСТРУКЦИЯ:');
    console.log('1. Выполните эту функцию на КАЖДОЙ странице');
    console.log('2. После перезагрузки страницы выполните:');
    console.log('   loadAndContinueCollection()');
    console.log('3. Повторяйте для всех страниц');
    
    return savedData;
}

// Функция для продолжения сбора после перезагрузки
function loadAndContinueCollection() {
    const saved = JSON.parse(localStorage.getItem('exhibitorCollection') || '{}');
    const currentPage = saved.currentPage || 1;
    
    // Собираем текущую страницу
    const currentCards = document.querySelectorAll('[data-exib]');
    const currentIds = Array.from(currentCards).map(card => card.getAttribute('data-exib'));
    
    // Обновляем сохраненные данные
    const allIds = new Set([...saved.ids, ...currentIds]);
    const processedPages = [...(saved.processedPages || []), currentPage];
    
    const updatedData = {
        ids: Array.from(allIds),
        currentPage: currentPage,
        totalPages: saved.totalPages || 1,
        processedPages: processedPages
    };
    
    localStorage.setItem('exhibitorCollection', JSON.stringify(updatedData));
    
    console.log(`📊 Страница ${currentPage}: ${currentIds.length} карточек`);
    console.log(`📈 Всего собрано: ${allIds.size} уникальных ID`);
    console.log('✅ Данные сохранены в localStorage');
    
    // Показываем следующие шаги
    const nextPage = currentPage + 1;
    const pagination = document.querySelector('.pagination');
    const pageButtons = Array.from(pagination?.querySelectorAll('a') || []);
    
    if (nextPage <= updatedData.totalPages) {
        console.log(`\n🔄 ДЛЯ ПРОДОЛЖЕНИЯ:`);
        console.log(`1. Кликните на страницу ${nextPage}`);
        console.log(`2. После перезагрузки выполните: loadAndContinueCollection()`);
    } else {
        console.log('\n🎉 СБОР ЗАВЕРШЕН!');
        console.log('📋 Все собранные ID:', updatedData.ids.sort((a, b) => a - b));
        localStorage.removeItem('exhibitorCollection'); // Очищаем
    }
    
    return updatedData;
}

// Функция для просмотра текущего прогресса
function showProgress() {
    const saved = JSON.parse(localStorage.getItem('exhibitorCollection') || '{}');
    console.log('📊 ТЕКУЩИЙ ПРОГРЕСС:');
    console.log('   Обработано страниц:', saved.processedPages || []);
    console.log('   Собрано ID:', saved.ids ? saved.ids.length : 0);
    console.log('   Всего страниц:', saved.totalPages || 'неизвестно');
    
    if (saved.ids) {
        console.log('   ID:', saved.ids.sort((a, b) => a - b));
    }
    
    return saved;
}

// Функция для начала сбора
function startCollection() {
    console.log('🚀 НАЧИНАЕМ СБОР ДАННЫХ');
    console.log('Выполняйте команды по порядку:\n');
    console.log('1. На странице 1 выполните: collectAllIdsWithStorage()');
    console.log('2. Кликните на страницу 2');
    console.log('3. После перезагрузки выполните: loadAndContinueCollection()');
    console.log('4. Повторяйте шаги 2-3 для всех страниц');
    console.log('5. Для просмотра прогресса: showProgress()');
}

[
    "112182",
    "111600",
    "111786",
    "111955",
    "112114",
    "111985",
    "111630",
    "111556",
    "111432",
    "112049",
    "111784",
    "111804",
    "112146",
    "111367",
    "111707",
    "111595",
    "112104",
    "111923",
    "111928",
    "111954",
    "111596",
    "112007",
    "112014",
    "111974",
    "111779",
    "112236",
    "112312",
    "111576",
    "111605",
    "111891",
    "111562",
    "111811",
    "111927",
    "112300",
    "111370",
    "111783",
    "112072",
    "111579",
    "111925",
    "112226",
    "112229",
    "111792",
    "111425"
]