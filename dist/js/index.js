/*
CREATE TABLE "courses" (
	"id" INTEGER PRIMARY KEY NOT NULL,
	"name" VARCHAR(255) NOT NULL
);
CREATE TABLE "groups" (
	"id" INTEGER PRIMARY KEY NOT NULL,
	"name" VARCHAR(255) NOT NULL
);
CREATE TABLE "hours" (
	"id" INTEGER PRIMARY KEY NOT NULL,
	"from" VARCHAR(255) NOT NULL,
	"to" VARCHAR(255) NOT NULL
);
CREATE TABLE "lecturers" (
	"id" INTEGER PRIMARY KEY NOT NULL,
	"name" VARCHAR(255) NOT NULL
);
CREATE TABLE "lessons" (
	"id" INTEGER PRIMARY KEY NOT NULL,
	"week" INTEGER NOT NULL,
	"weekday" INTEGER NOT NULL,
	"hour_id" INTEGER NOT NULL
);
CREATE TABLE "rooms" (
	"id" INTEGER PRIMARY KEY NOT NULL,
	"name" VARCHAR(255) NOT NULL
);
CREATE TABLE "lessonGroupRel" (
	"lesson_id" INTEGER NOT NULL,
	"group_id" INTEGER NOT NULL
);
CREATE TABLE "lessonLecturerRel" (
	"lesson_id" INTEGER NOT NULL,
	"lecturer_id" INTEGER NOT NULL
);
CREATE TABLE "lessonRoomRel" (
	"lesson_id" INTEGER NOT NULL,
	"room_id" INTEGER NOT NULL
);
*/

require(['jquery', 'search', 'table'], function ($, search, Table) {
	var MAX_SEARCH_RESULTS = 5;
	var lastResults;

	var $search = $('#search');
	var $searchAutocomplete = $('#search-autocomplete');
	var $searchForm = $('#search-form');
	var $tempTables = $('#temp-tables');
	var $tables = $('#tables');


	// init vars IIFE
	(function () {
		var fragment = document.createDocumentFragment();

		for (var i = 0; i < MAX_SEARCH_RESULTS; i++) {
			var li = document.createElement('li');

			var a = document.createElement('a');
			a.href = 'javascript:void(0)';

			li.appendChild(a);

			fragment.appendChild(li);
		}

		$searchAutocomplete.append(fragment);
	})();


	$search
		.on('input', function () {
			var needle = this.value.trim();
			var re = new RegExp(needle, 'gi');

			if (needle.length >= 3) {
				lastResults = search(needle).slice(0, MAX_SEARCH_RESULTS);

				for (var ul = $searchAutocomplete[0], i = 0; i < MAX_SEARCH_RESULTS; i++) {
					var result = lastResults[i];
					var html = '<span>' + result.entry.name.replace(re, '<strong>$&</strong>') + '</span> <span class="text-info">' + result.type + '</span>';
					ul.children[i].firstElementChild.innerHTML = html;
				}

				$searchAutocomplete.show();
			} else {
				$searchAutocomplete.hide();
			}
		})
		.on('focus', function () {
			if (this.value.length >= 3) {
				$searchAutocomplete.show();
			}
		})
		.on('blur', function () {
			$searchAutocomplete.hide();
		})
		.on('keyup', function (event) {
			var which = event.which;

			if (which === 38) {
				// up
			} else if (which === 40) {
				// down
			}
		});

	$searchAutocomplete
		.on('mousedown', function () {
			return false;
		})
		.on('click', 'li', function () {
			$search
				.val(this.children[0].children[0].textContent)
				.trigger('input')
				.submit();
			return false;
		});

	$searchForm
		.on('submit', function () {
			var needle = $search.val().toLowerCase();
			var searchResult = lastResults[0];

			// if the current input value is the same as the first search result, it must be a match with some entry
			if (needle === searchResult.key) {
				var table = new Table(searchResult);

				$tempTables.html('').append(table.container);
				$search.blur();
			}

			return false;
		});

	$tempTables
		.on('click', 'a', function () {
			var m = this.hash.match(/^#(group|lecturer|lesson|room)-(\d+)$/);

			if (m) {
				var type = m[1];
				var id = parseInt(m[2]);
				console.log(type, id);
				return false;
			}
		});
});
