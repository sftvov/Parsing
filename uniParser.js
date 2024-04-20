const axios = require('axios'); // Подключение модуля axios для скачивания страницы
const { log } = require('console');
const fs = require('fs'); // Подключение встроенного в Node.js модуля fs для работы с файловой системой
const jsdom = require('jsdom'); // Подключение модуля jsdom для работы с DOM-деревом (1)
const { JSDOM } = jsdom; // Подключение модуля jsdom для работы с DOM-деревом (2)
const mainLink = 'https://pamyatnik-spb.ru/';
const pagination = '?page=';

let timeout = 0;
let data = [];
let row = 0;

let attributeLength = 0;

axios.get(mainLink).then((response) => {
	const dom = new JSDOM(response.data);
	let pageLinks = dom.window.document.querySelectorAll('.nav.navbar-nav a');
	// pageLinks = [pageLinks[2]];
	for (let i = 0; i < pageLinks.length; i++) {
		const href = pageLinks[i].getAttribute('href');
		setTimeout(() => {
			parsingCategory(href);
		}, timeout);
		timeout += 100;
		// calls.push(['parsingCategory', timeout, href]);
		// console.log(calls);
	}
});

setTimeout(saveCSV, 100000);

function parsingCategory(href) {
	axios.get(href).then((response) => {
		const dom = new JSDOM(response.data);
		const paginationSpan = dom.window.document.querySelector('.pagination_wrap.row .col-sm-6.text-right');
		if (paginationSpan) {
			const pagesString = paginationSpan.innerHTML.trim();
			const pages = pagesString.match(/всего (\d+) /)[1];
			for (let i = 1; i <= pages; i++) {
				setTimeout(() => {
					parsingPagination(href, i);
				}, timeout);
				timeout += 100;
				// calls.push(['parsingPagination', timeout, href]);
				// console.log(calls);
			}
		} else console.log('not find pagination');
	});
}

function parsingPagination(pageLink, num) {
	const curLink = pageLink + pagination + num;
	axios.get(curLink).then((response) => {
		const dom = new JSDOM(response.data);
		const products = dom.window.document.querySelectorAll('.product-thumb');
		for (let i = 0; i < products.length; i++) {
			const product = products[i];
			const href = product.querySelector('a').getAttribute('href');
			setTimeout(() => {
				parsingProduct(href);
			}, timeout);
			timeout += 100;
			// calls.push(['parsingProduct', timeout, href]);
			// console.log(calls);
		}
	});
}

function parsingProduct(href) {
	axios.get(href).then((response) => {
		data[row] = [];
		const dom = new JSDOM(response.data);
		const product = dom.window.document;
		const name = product
			.querySelector('.heading span')
			.textContent.replace(/\r?\n|\r/g, ' ')
			.trim();
		data[row].push(name);
		const category = product.querySelector('.breadcrumb li:nth-child(2) a').textContent;
		data[row].push(category);
		const price = product
			.querySelector('.price span')
			.innerHTML.trim()
			.match(/([\d ]+)\./)[1];
		data[row].push(price);
		const img = product.querySelector('.thumbnails img').src;
		data[row].push(img);
		data[row].push(3);
		const description = product
			.querySelector('#tab-description')
			.textContent.replace(/\r?\n|\r/g, ' ')
			.trim();
		data[row].push(description);
		const attributesHtml = product.querySelectorAll('.attribute div');
		for (let i = 0; i < attributesHtml.length; i++) {
			attributesHtml.length > attributeLength ? (attributeLength = attributesHtml.length) : false;
			data[row].push(attributesHtml[i].querySelector('span:first-child span').innerHTML.trim());
			data[row].push(attributesHtml[i].querySelector('span:nth-child(2) span').innerHTML.trim());
			data[row].push('');
			data[row].push(1);
		}
		row++;
		console.log(timeout + ' ' + row);
	});
}

function saveCSV() {
	const separator = '%';
	let attributeHeads = '';
	for (let i = 1; i <= attributeLength; i++) {
		attributeHeads += separator + 'Attribute ' + i + ' name' + separator + 'Attribute ' + i + ' value(s)' + separator + 'Attribute ' + i + ' default' + separator + 'Attribute ' + i + ' global';
	}
	let csv = 'Name' + separator + 'Categories' + separator + 'Regular price' + separator + 'Images' + separator + 'Stock' + separator + 'Description' + attributeHeads + '\n';
	csv += data.map((row) => row.join(separator)).join('\n');
	fs.writeFileSync('pam.csv', csv);
	console.log('parsing done after ' + timeout);
}
