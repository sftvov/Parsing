function renameCats(str) {
	const obj = {
		Худи: 'hudi',
	};

	const entries = Object.entries(obj);

	for (const name of entries) {
		if (str === name[1]) str = name[0];
	}

	return str;
}

console.log(renameCats('hudi'));
