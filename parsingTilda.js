// const linkTilda = 'https://store.tildacdn.com/api/getproductslist/?storepartuid=433685419311&recid=236139262&c=1687441112429&getparts=true&getoptions=true&slice=1&sort;5Bcreated;5D=desc&size=64';
const { log } = require('console');

function parsingTilda() {
	axios
		.get(link)
		.then((response) => {
			let data = [];
			let row = 0;
			const products = response.data.products;
			for (let i = 0; i < products.length; i++) {
				data[row] = [];
				data[row].push(products[i].uid);
				data[row].push('');
				data[row].push(products[i].title);
				data[row].push(products[i].descr);
				function replaceAll(string, search, replace) {
					return string.split(search).join(replace);
				}
				const text = replaceAll(products[i].text, '%', ' процентов');
				data[row].push(text);
				data[row].push('');
				data[row].push('');
				data[row].push(JSON.parse(products[i].gallery).map((o) => o.img));
				let url = replaceAll(products[i].url, 'catalog/', '');
				url = replaceAll(url, 'tproduct/', '');
				console.log(i);
				data[row].push(renameCats(url.match(/https:\/\/xvoybrand\.ru\/?(\w*)\//)[1]));
				let attr1 = {};
				let attr2 = {};
				if (products[i].hasOwnProperty('json_options') && products[i].json_options[0]) {
					attr1 = JSON.parse(products[i].json_options)[0];
					data[row].push(attr1.title);
					data[row].push(attr1.values);
					data[row].push(attr1.values[0]);
					data[row].push(1);
					if (JSON.parse(products[i].json_options)[1]) {
						attr2 = JSON.parse(products[i].json_options)[1];
						data[row].push(attr2.title);
						data[row].push(attr2.values);
						data[row].push(attr2.values[0]);
						data[row].push(1);
					} else {
						attr2 = '';
						data[row].push('');
						data[row].push('');
						data[row].push('');
					}
				} else {
					attr1.title = '';
					attr2.title = '';
					data[row].push('');
					data[row].push('');
				}
				if (products[i].editions) {
					data[row].push('variable');
					data[row].push('');
					row++;
					let ed = products[i].editions;
					for (let i2 = 0; i2 < ed.length; i2++) {
						let num = row + i2;
						data[num] = [];
						data[num].push(ed[i2].uid);
						data[num].push(products[i].uid);
						data[num].push('');
						data[num].push('');
						data[num].push('');
						if (ed[i2].priceold) {
							data[num].push(ed[i2].price);
							data[num].push(ed[i2].priceold);
						} else {
							data[num].push('');
							data[num].push(ed[i2].price);
						}
						data[num].push('');
						data[num].push('');
						data[num].push(attr1.title);
						data[num].push(ed[i2][attr1.title]);
						data[num].push('');
						data[num].push(1);
						data[num].push(attr2.title);
						data[num].push(ed[i2][attr2.title]);
						data[num].push('');
						data[num].push(1);
						data[num].push('variation');
						data[num].push(ed[i2].quantity);
					}
					row += ed.length;
				}
			}
			return data;
		})
		.then((response) => {
			let csv = 'SKU%Parent%Name%Short description%Description%Sale price%Regular price%Images%Categories%Attribute 1 name%Attribute 1 value(s)%Attribute 1 default%Attribute 1 global%Attribute 2 name%Attribute 2 value(s)%Attribute 2 default%Attribute 2 global%Type%Stock\n';
			csv += response.map((row) => row.join('%')).join('\n');
			fs.writeFileSync('some.csv', csv);
		});
	return; // Завершение работы функции
}

function renameCats(str) {
	const obj = {
		varezhki: 'Одежда для города > Варежки',
		teplogrejki: 'Одежда для катания > Теплогрейки',
		shtany: 'Одежда для города > Штаны',
		polukombinezony: 'Одежда для катания > Полукомбинезоны',
		panamy: 'Одежда для города > Панамы',
		kurtki: 'Одежда для катания > Куртки',
		hudi: 'Одежда для катания > Худи',
		hudisnow: 'Одежда для катания > Худи',
		anoraki: 'Одежда для катания > Анораки',
	};

	const entries = Object.entries(obj);

	for (const name of entries) {
		if (str === name[0]) str = name[1];
	}

	return str;
}
