const progress = [
  {
    direction: 'Промышленность',
    categories: [
      {
        category: 'Управление производством',
        subcategories: [
          { name: 'Руководителям производств' },
          { name: 'Управление цехом' },
          { name: 'Конструкторам' },
          { name: 'Технологам' },
          { name: 'Обслуживание оборудования' },
          { name: 'Автоматизация' },
        ],
      },
      {
        category: 'Материалы, технологии, оборудование',
        subcategories: [],
      },
      {
        category: 'Бережливое производство',
        subcategories: [],
      },
      {
        category: 'Гособоронзаказ',
        subcategories: [],
      },
      {
        category: 'Импортозамещение',
        subcategories: [],
      },
      {
        category: 'Управление качеством',
        subcategories: [],
      },
      {
        category: 'Стандартизация. Метрология',
        subcategories: [],
      },
      {
        category: 'Закупки. Снабжение. Склад',
        subcategories: [{ name: 'Закупки и снабжение' }, { name: 'Госзакупки' }, { name: 'Склад' }],
      },
      {
        category: 'Транспорт',
        subcategories: [{ name: 'ЖД перевозки' }, { name: 'Автотранспорт' }, { name: 'Транспортная логистика' }],
      },
      {
        category: 'Интеллектуальная собственность',
        subcategories: [],
      },
      {
        category: 'Управление инновациями',
        subcategories: [],
      },
      {
        category: 'Легкая промышленность',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Безопасность',
    categories: [
      {
        category: 'Экономическая и юридическая',
        subcategories: [],
      },
      {
        category: 'Кадровые риски',
        subcategories: [],
      },
      {
        category: 'Пожарная безопасность',
        subcategories: [],
      },
      {
        category: 'Безопасность систем управления',
        subcategories: [],
      },
      {
        category: 'Промышленная безопасность',
        subcategories: [],
      },
      {
        category: 'Экологическая безопасность',
        subcategories: [],
      },
      {
        category: 'Информационная безопасность',
        subcategories: [],
      },
      {
        category: 'Охрана труда',
        subcategories: [],
      },
      {
        category: 'Комплексная безопасность',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Энергетика',
    categories: [
      {
        category: 'Энергосбережение',
        subcategories: [],
      },
      {
        category: 'Экономика и инвестиции в энергетике',
        subcategories: [],
      },
      {
        category: 'Правовое регулирование в энергетике',
        subcategories: [],
      },
      {
        category: 'Эксплуатация объектов ТЭК',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Строительство и инженерные сети',
    categories: [
      {
        category: 'Проектирование. Изыскания',
        subcategories: [],
      },
      {
        category: 'Строительство: организация и управление',
        subcategories: [],
      },
      {
        category: 'Инженерные сети: проектирование и строительство',
        subcategories: [{ name: 'Слаботочные системы' }, { name: 'Газоснабжение' }, { name: 'Водоснабжение и водоотведение' }, { name: 'Теплоснабжение и вентиляция' }, { name: 'Электроснабжение' }],
      },
      {
        category: 'Строительные материалы и технологии',
        subcategories: [],
      },
      {
        category: 'Дорожное строительство',
        subcategories: [],
      },
      {
        category: 'Экономика строительства',
        subcategories: [],
      },
      {
        category: 'Сметное дело',
        subcategories: [],
      },
      {
        category: 'Правовое регулирование строительной деятельности',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'ЖКХ. Городское хозяйство',
    categories: [
      {
        category: 'ЖКХ. Городское хозяйство',
        subcategories: [],
      },
      {
        category: 'Ремонт и эксплуатация зданий и сооружений',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Недвижимость',
    categories: [
      {
        category: 'Управление и эксплуатация недвижимости',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Экология и землепользование',
    categories: [
      {
        category: 'Экология',
        subcategories: [],
      },
      {
        category: 'Недропользование',
        subcategories: [],
      },
      {
        category: 'Землепользование',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Управление персоналом',
    categories: [
      {
        category: 'Трудовое право. Кадровое делопроизводство',
        subcategories: [{ name: 'Трудовое право' }, { name: 'Кадровое делопроизводство' }],
      },
      {
        category: 'HR-технологии. Управление персоналом',
        subcategories: [{ name: 'Управление персоналом' }, { name: 'HR-технологии' }, { name: 'Оценка и обучение персонала' }, { name: 'Мотивация персонала' }],
      },
    ],
  },
  {
    direction: 'Офисные службы',
    categories: [
      {
        category: 'Работа с руководителем',
        subcategories: [],
      },
      {
        category: 'Делопроизводство',
        subcategories: [],
      },
      {
        category: 'Архивы',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Менеджмент',
    categories: [
      {
        category: 'Общий менеджмент',
        subcategories: [],
      },
      {
        category: 'Специальный менеджмент',
        subcategories: [],
      },
      {
        category: 'Управление административно-хозяйственной деятельностью',
        subcategories: [],
      },
      {
        category: 'Спортивный менеджмент',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Маркетинг. PR',
    categories: [
      {
        category: 'Маркетинг. Продажи',
        subcategories: [],
      },
      {
        category: 'Реклама. PR',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Экономика. Финансы. Бухгалтерский учет',
    categories: [
      {
        category: 'Налогообложение',
        subcategories: [],
      },
      {
        category: 'Бухгалтерский учет',
        subcategories: [{ name: 'Бухгалтерский учет в коммерческих организациях' }, { name: 'Бюджетный учет' }, { name: 'Отраслевой учет' }],
      },
      {
        category: 'Финансовый менеджмент. Экономика',
        subcategories: [],
      },
      {
        category: 'Оплата труда и мотивация',
        subcategories: [],
      },
      {
        category: 'Нормирование труда',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Право. ВЭД',
    categories: [
      {
        category: 'Корпоративное право',
        subcategories: [],
      },
      {
        category: 'Гражданское и процессуальное право',
        subcategories: [],
      },
      {
        category: 'Другие отрасли права',
        subcategories: [],
      },
      {
        category: 'Право по виду деятельности',
        subcategories: [],
      },
      {
        category: 'Договорная работа',
        subcategories: [],
      },
      {
        category: 'Внешнеэкономическая деятельность',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Информационные технологии',
    categories: [
      {
        category: 'Управление ИТ-инфраструктурой',
        subcategories: [],
      },
      {
        category: 'Программное обеспечение',
        subcategories: [],
      },
      {
        category: 'Кибербезопасность и защита данных',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Связь',
    categories: [
      {
        category: 'Проектирование и строительство объектов связи',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Государственное и муниципальное управление',
    categories: [
      {
        category: 'Организация деятельности учреждений и органов власти',
        subcategories: [],
      },
      {
        category: 'Бюджетное финансирование',
        subcategories: [],
      },
      {
        category: 'Некоммерческие организации',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Социальная защита',
    categories: [
      {
        category: 'Организация работы органов социальной защиты населения',
        subcategories: [],
      },
      {
        category: 'Технологии социального обслуживания',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Медицина',
    categories: [
      {
        category: 'Организация здравоохранения',
        subcategories: [],
      },
      {
        category: 'Право в здравоохранении',
        subcategories: [],
      },
      {
        category: 'Экономика и финансы в здравоохранении',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Образование',
    categories: [
      {
        category: 'Высшее образование',
        subcategories: [],
      },
      {
        category: 'Среднее профессиональное образование',
        subcategories: [],
      },
      {
        category: 'Дополнительное профессиональное образование',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Культура',
    categories: [
      {
        category: 'Управление в сфере культуры',
        subcategories: [],
      },
      {
        category: 'Театры. ДК',
        subcategories: [],
      },
      {
        category: 'Музеи. Библиотеки',
        subcategories: [],
      },
      {
        category: 'Организация культурно-досуговых мероприятий',
        subcategories: [],
      },
      {
        category: 'Технологии: звук, свет, сцена',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Массмедиа',
    categories: [
      {
        category: 'СМИ, редакция',
        subcategories: [],
      },
      {
        category: 'Дизайн',
        subcategories: [],
      },
      {
        category: 'Переводы',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'Агропромышленный комплекс',
    categories: [
      {
        category: 'Пищевое производство',
        subcategories: [],
      },
      {
        category: 'Сельское хозяйство',
        subcategories: [],
      },
    ],
  },
  {
    direction: 'HoReCa',
    categories: [
      {
        category: 'Гостиницы',
        subcategories: [],
      },
      {
        category: 'Общепит',
        subcategories: [],
      },
      {
        category: 'ХАССП и контроль качества',
        subcategories: [],
      },
    ],
  },
];

const axios = require('axios');
const fs = require('fs');
const { JSDOM } = require('jsdom');

// НАСТРОЙКИ
const BASE_URL = 'https://www.cntiprogress.ru/seminarsforcolumn/';
const OUTPUT_FILENAME = 'cntiprogress-courses.csv';
const USE_ANSI_ENCODING = true;
const TOTAL_PAGES = 68; // Всего страниц

// Функция для поиска категории и подкатегории по названию
function findCategoryInfo(categoryName) {
  for (const direction of progress) {
    for (const cat of direction.categories) {
      // Проверяем основную категорию
      if (cat.category === categoryName) {
        return {
          direction: direction.direction,
          category: cat.category,
          subcategory: null,
        };
      }

      // Проверяем подкатегории
      for (const subcat of cat.subcategories) {
        if (subcat.name === categoryName) {
          return {
            direction: direction.direction,
            category: cat.category,
            subcategory: subcat.name,
          };
        }
      }
    }
  }
  return null;
}

async function parseCourses() {
  try {
    console.log('Начинаем парсинг курсов...');

    // Подготовка данных для CSV
    let csvData = 'Направление;Категория;Название курса;Ссылка\n';

    let totalCoursesWithVideo = 0;

    // Обрабатываем все страницы
    for (let pageNum = 1; pageNum <= TOTAL_PAGES; pageNum++) {
      let pageUrl;
      if (pageNum === 1) {
        pageUrl = BASE_URL + 'default.aspx';
      } else {
        pageUrl = BASE_URL + `page${pageNum}.aspx`;
      }

      console.log(`Обрабатываем страницу ${pageNum}/${TOTAL_PAGES}: ${pageUrl}`);

      try {
        // Получаем страницу с курсами
        const pageResponse = await axios.get(pageUrl, { timeout: 15000 });
        const pageDom = new JSDOM(pageResponse.data);
        const pageDocument = pageDom.window.document;

        // Находим все ссылки на курсы
        const courseLinks = pageDocument.querySelectorAll('.name_seminar a');
        console.log(`  Найдено курсов на странице: ${courseLinks.length}`);

        // Обрабатываем каждый курс
        for (let i = 0; i < courseLinks.length; i++) {
          const linkElement = courseLinks[i];
          const courseUrl = linkElement.href;
          const courseName = linkElement.textContent.trim();

          console.log(`    Курс [${i + 1}/${courseLinks.length}]: ${courseName}`);

          try {
            // Переходим на страницу курса
            const courseResponse = await axios.get(courseUrl, { timeout: 15000 });
            const courseDom = new JSDOM(courseResponse.data);
            const courseDocument = courseDom.window.document;

            // Проверяем наличие блока с видео
            const videoBlock = courseDocument.getElementById('tabs-video');

            if (videoBlock) {
              console.log('      ✓ Найден блок с видео');
              totalCoursesWithVideo++;

              // Получаем категорию из хлебных крошек
              const categoryFromPage = getCategoryFromBreadcrumbs(courseDocument);

              // Ищем информацию о категории в объекте progress
              const categoryInfo = findCategoryInfo(categoryFromPage);

              let direction = 'Неизвестно';
              let fullCategory = categoryFromPage;

              if (categoryInfo) {
                direction = categoryInfo.direction;
                // Формируем полное название категории
                if (categoryInfo.subcategory) {
                  fullCategory = `${categoryInfo.category}/${categoryInfo.subcategory}`;
                } else {
                  fullCategory = categoryInfo.category;
                }
              }

              // Добавляем данные в CSV
              csvData += `"${direction}";"${fullCategory}";"${cleanSpaces(courseName)}";"${courseUrl}"\n`;

              console.log(`      Направление: ${direction}`);
              console.log(`      Категория: ${fullCategory}`);
            } else {
              console.log('      ✗ Нет блока с видео');
            }

            // Задержка между запросами
            await delay(1000);
          } catch (error) {
            console.error(`      Ошибка при обработке курса ${courseUrl}:`, error.message);
          }
        }

        // Задержка между страницами
        await delay(2000);
      } catch (error) {
        console.error(`Ошибка при обработке страницы ${pageUrl}:`, error.message);
      }
    }

    // Сохраняем результат
    saveToFile(csvData, OUTPUT_FILENAME);
    console.log(`\nПарсинг завершен!`);
    console.log(`Найдено курсов с видео: ${totalCoursesWithVideo}`);
    console.log(`Данные сохранены в ${OUTPUT_FILENAME}`);
  } catch (error) {
    console.error('Произошла ошибка:', error.message);
  }
}

// Функция для получения категории из хлебных крошек
function getCategoryFromBreadcrumbs(document) {
  const breadcrumbs = document.querySelectorAll('#breadcrumbs a');
  if (breadcrumbs.length >= 3) {
    // Берем последнюю ссылку (категорию)
    const lastLink = breadcrumbs[breadcrumbs.length - 1];
    return cleanSpaces(lastLink.textContent);
  }
  return 'Неизвестно';
}

// Функция для очистки лишних пробелов
function cleanSpaces(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Вспомогательные функции
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function saveToFile(data, filename) {
  if (USE_ANSI_ENCODING) {
    const iconv = require('iconv-lite');
    const buffer = iconv.encode(data, 'win1251');
    fs.writeFileSync(filename, buffer);
  } else {
    fs.writeFileSync(filename, data, 'utf8');
  }
}

// Запускаем парсинг
parseCourses();
