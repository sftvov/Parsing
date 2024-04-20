const axios = require('axios'); // Подключение модуля axios для скачивания страницы
const fs = require('fs'); // Подключение встроенного в Node.js модуля fs для работы с файловой системой
const jsdom = require('jsdom'); // Подключение модуля jsdom для работы с DOM-деревом (1)
const { JSDOM } = jsdom; // Подключение модуля jsdom для работы с DOM-деревом (2)
const mainLink = 'https://pamyatnik-spb.ru/gorizontalnye_pamyatniki/';

const pagination = '?page=';
const pages = 3;
const category = 'gorizontalnye';

function parsing() {
	let data = [];
	let row = 0;
	for (let i = 1; i <= pages; i++) {
		const curLink = mainLink + pagination + i;
		axios
			.get(curLink)
			.then((response) => {
				const dom = new JSDOM(response.data);
				const products = dom.window.document.querySelectorAll('.product-thumb');
				for (let i = 0; i < products.length; i++) {
					const product = products[i];
					data[row] = [];
					const name = product.querySelector('.caption a').innerHTML;
					data[row].push(name);
					const price = product.querySelector('.price').innerHTML.trim();
					data[row].push(price);
					const img = product.querySelector('.image img').src;
					data[row].push(img);
					data[row].push(3);
					data[row].push(category);
					row++;
				}
				return data;
			})
			.then((response) => {
				let csv = 'Name%Regular price%Images%Stock%Categories\n';
				csv += response.map((row) => row.join('%')).join('\n');
				fs.writeFileSync('pam.csv', csv);
			});
	}
	return; // Завершение работы функции
}

parsing(); // Запуск
