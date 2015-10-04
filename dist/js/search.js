define('search', ['rawa'], function (rawaData) {
	// Damerau–Levenshtein-Distance
	function levenshteinDistance(s, t) {
		var n = s.length;
		var m = t.length;

		// Step 1
		if (n === 0) {
			return m;
		}
		if (m === 0) {
			return n;
		}

		// 2d matrix
		var d = new Array(n + 1);

		// Step 2
		for (var i = 0; i <= n; i++) {
			var e = new Array(m + 1);
			e[0] = i;
			d[i] = e;
		}
		for (var j = 0; j <= m; j++) {
			d[0][j] = j;
		}

		// Step 3
		for (var i = 1; i <= n; i++) {
			var s_i = s[i - 1];

			// Step 4
			for (var j = 1; j <= m; j++) {
				if (i === j && d[i][j] > 4) {
					return n;
				}

				var t_j = t[j - 1];
				var cost = (s_i === t_j) ? 0 : 1; // Step 5

				// calculate the minimum
				var mi = d[i - 1][j] + 1;
				var b;

				b = d[i][j - 1] + 1;
				if (b < mi) {
					mi = b;
				}

				b = d[i - 1][j - 1] + cost;
				if (b < mi) {
					mi = b;
				}

				//Damerau transposition
				if (i > 1 && j > 1 && s_i === t[j - 2] && t_j === s[i - 2] && (b = d[i - 2][j - 2] + cost) < mi) {
					mi = b;
				}

				d[i][j] = mi; // Step 6
			}
		}

		// Step 7
		return d[n][m];
	}


	/**
	 * @param {string} type   must be courses, groups, lecturers, or rooms
	 * @param {object} entry  must be an entry of the rawaData[type] array
	 */
	function SearchEntry(type, entry) {
		this.type = type;
		this.entry = entry;
		this.key = entry.name.toLowerCase();
		this.ranking = 0;
	}

	SearchEntry.prototype.updateWithNeedle = function (needle) {
		var key = this.key;
		var idx = key.indexOf(needle);
		var distance = levenshteinDistance(key, needle);

		this.ranking = (idx === -1 ? 1e3 : idx * 2) + distance;
	};


	var searchSources = [ 'courses', 'groups', 'lecturers', 'rooms' ];
	var searchData = new Array(searchSources.reduce(function (sum, val) {
		return sum + rawaData[val].length;
	}, 0));

	for (var i = 0, j = 0; j < searchSources.length; j++) {
		var name = searchSources[j];
		var type = name.slice(0, -1);
		var source = rawaData[name];

		for (var k = 0; k < source.length; k++) {
			searchData[i++] = new SearchEntry(type, source[k]);
		}
	}

	function search(needle) {
		needle = needle.toLowerCase();

		for (var i = 0; i < searchData.length; i++) {
			searchData[i].updateWithNeedle(needle);
		}

		return searchData.sort(function (a, b) {
			return a.ranking - b.ranking;
		});
	}

	return search;
});
