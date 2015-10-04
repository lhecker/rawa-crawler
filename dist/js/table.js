define('table', ['rawa'], function (rawaData) {
	var weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
	var hours = rawaData.hours;

	/*
	 * usage:
	 * relations[fromType][toType][fromId] => {Array} (array of toIds)
	 */
	var relations = { lesson : {} };

	function mapRelationToArray(array, fromKey, toKey) {
		var ret = [];

		for (var i = 0; i < array.length; i++) {
			var rel = array[i];
			var fromId = rel[fromKey];

			(ret[fromId] || (ret[fromId] = [])).push(rel[toKey]);
		}

		return ret;
	}

	['group', 'lecturer', 'room'].forEach(function (key) {
		var data = rawaData['lesson' + key[0].toUpperCase() + key.substring(1) + 'Rel'];
		var lessonKey = 'lesson_id';

		relations[key] = { lesson : mapRelationToArray(data, key + '_id', lessonKey) };
		relations.lesson[key] = mapRelationToArray(data, lessonKey, key + '_id');
	});

	var ret = new Array(rawaData.courses.length);
	var lessons = rawaData.lessons;

	for (var i = 0; i < lessons.length; i++) {
		var lesson = lessons[i];
		var course_id = lesson.course_id;

		(ret[course_id] || (ret[course_id] = [])).push(lesson.id);
	}

	relations.course = { lesson : ret };

	for (var from in relations) {
		var o = relations[from];

		for (var to in o) {
			var list = o[to];

			for (var i = 0; i < list.length; i++) {
				var sublist = list[i];
				list[i] = sublist ? sublist.sort() : [];
			}
		}
	}


	var protoTableContainer = document.createElement('div');
	protoTableContainer.classList.add('table-responsive');

	for (var week = 0; week < 2; week++) {
		var table = document.createElement('table');
		var tHead = document.createElement('thead');
		var tBody = document.createElement('tbody');

		table.className = 'table table-bordered table-striped';

		{
			var tHeadTr = document.createElement('tr');
			var appendTh = function (val) {
				var th = document.createElement('th');
				th.textContent = val;
				tHeadTr.appendChild(th);
			};

			appendTh('Week ' + (week + 1));
			weekdays.forEach(appendTh);

			tHead.appendChild(tHeadTr);
		}

		for (var hour_id = 0; hour_id < hours.length; hour_id++) {
			var tr = document.createElement('tr');

			var hour = hours[hour_id];
			var td = document.createElement('td');
			td.textContent = hour.from.substring(0, 5) + ' - ' + hour.to.substring(0, 5);
			tr.appendChild(td);

			for (var weekday = 0; weekday < 5; weekday++) {
				tr.appendChild(document.createElement('td'));
			}

			tBody.appendChild(tr);
		}

		table.appendChild(tHead);
		table.appendChild(tBody);
		protoTableContainer.appendChild(table);
	}

	function lessonIdToEntry(id) {
		return rawaData.lessons[id];
	}

	function groupIdToLink(id) {
		return '<a href="#group-' + id + '">' + rawaData.groups[id].name + '</a>';
	}

	function lecturerIdToLink(id) {
		return '<a href="#lecturer-' + id + '">' + rawaData.lecturers[id].name + '</a>';
	}

	function lessonIdToLink(id) {
		return '<a href="#lesson-' + id + '">' + rawaData.lessons[id].name + '</a>';
	}

	function roomIdToLink(id) {
		return '<a href="#room-' + id + '">' + rawaData.rooms[id].name + '</a>';
	}

	function Table(searchEntry) {
		var type = searchEntry.type;
		var results = relations[type].lesson[searchEntry.entry.id].map(lessonIdToEntry);
		var tableContainer = protoTableContainer.cloneNode(true);

		for (var i = 0; i < results.length; i++) {
			var lesson = results[i];
			var id = lesson.id;

			var td = tableContainer
				.children[lesson.week - 1]     // table
				.tBodies[0]                    // tBody
				.children[lesson.hour_id]      // tr
				.children[lesson.weekday + 1]; // td

			var innerHTML = td.innerHTML;
			var courseName = rawaData.courses[lesson.course_id].name;

			var list1;
			var list2;

			if (type === 'room') {
				list1 = relations.lesson.group[id].map(groupIdToLink);
			} else {
				list1 = relations.lesson.room[id].map(roomIdToLink);
			}

			if (type === 'lecturer') {
				list2 = relations.lesson.group[id].map(groupIdToLink);
			} else {
				list2 = relations.lesson.lecturer[id].map(lecturerIdToLink);
			}

			if (innerHTML) {
				innerHTML += '<br/><br/>';
			}

			innerHTML += courseName + '<br/>' + list1.join(', ') + ' - ' + list2.join(', ');

			td.innerHTML = innerHTML;
		}

		this.container = tableContainer;
	}

	return Table;
});
