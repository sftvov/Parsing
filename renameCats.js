function renameCats(str) {
	const obj = {
		Худи: 'hudi',
	};

	const entries = Object.entries(obj);

	for (const name of entries) {
		if (str === name) str = keys.find((key) => entries[key] === str);
	}

	return str;
}

console.log(renameCats('hudi'));
