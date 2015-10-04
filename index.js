var fs = require('fs');
var path = require('path');
var iconv = require('iconv-lite');
var request = require('request');


iconv.extendNodeEncodings();


function strcmp(a, b) {
	return (a > b) - (a < b);
}


var groupIds = [];
var groupIdsLength = 0;
var sql = [];
var rawData = [];

request({
	url : 'http://www2.htw-dresden.de/~rawa/cgi-bin/auf/raiplan_eing.php',
	encoding : 'iso-8859-1',
}, function (error, response, body) {
	if (error) {
		throw error;
	}

	console.assert(response.statusCode === 200);

	body = body.toString();

	var re = /<td>([^\/]+?\/[^\/]+?\/[^\/]+?)<\/td>/g;
	var m;

	while (m = re.exec(body)) {
		groupIds.push(m[1]);
	}

	groupIdsLength = groupIds.length;
	console.assert(groupIdsLength);

	console.log('added %d groups', groupIdsLength);
	process.nextTick(processNextGroup);
});


function processNextGroup() {
	var groupId = groupIds.shift();

	if (!groupId) {
		return finishedProcessing();
	}

	request({
		method : 'POST',
		url    : 'http://www2.htw-dresden.de/~rawa/cgi-bin/auf/raiplan.php',
		encoding : 'iso-8859-1',
		form : {
			matr : groupId,
		},
	}, function (error, response, body) {
		console.log('processing %d/%d %s', groupIdsLength - groupIds.length, groupIdsLength, groupId);

		if (error) {
			throw error;
		}

		console.assert(response.statusCode === 200);

		body = body.toString();

		var cells = new Array(70); // 2 abwechselnde wochen; 5 tage die woche; 7 stunden am tag
		var re = /<td>&nbsp;(.*?)<\/td>/g;
		var i = 0;

		for (var m; m = re.exec(body); i++) {
			cells[i] = m[1];
		}

		// TODO: einige gruppen haben am samstag unterricht
		if (i === 70) {
			for (var i = 0; i < cells.length; i++) {
				var week = Math.floor(i / 35) + 1;
				var weekday = i % 5;
				var hour = Math.floor((i % 35) / 5);

				var str = cells[i];

				if (str) {
					var re = /(?:^|<br><br>)(.+?)\s?<br>(.*?) - ([^<]*)/g;
					var m;

					while (m = re.exec(str)) {
						var course = m[1];
						var room = m[2];
						var lecturers = m[3];

						console.assert(course);

						rawData.push({
							group     : groupId,
							week      : week,
							weekday   : weekday,
							hour      : hour,
							course    : course,
							rooms     : room ? room.split(';') : [],
							lecturers : lecturers ? lecturers.split('/') : [],
						});
					}
				}
			}
		}

		process.nextTick(processNextGroup);
	});
}


function finishedProcessing() {
	var data = {
		timestamp         : Math.floor(Date.now() / 1000),
		hours             : [],
		groups            : [],
		lecturers         : [],
		courses           : [],
		rooms             : [],
		lessons           : [],
		lessonGroupRel    : [],
		lessonLecturerRel : [],
		lessonRoomRel     : [],
	};

	rawData = rawData.sort(function (a, b) {
		return strcmp(a.group, b.group) || (a.week - b.week) || (a.weekday - b.weekday) || (a.hour - b.hour);
	});

	data.hours.push({ id : data.hours.length, from : '07:30:00', to : '09:00:00' });
	data.hours.push({ id : data.hours.length, from : '09:20:00', to : '10:50:00' });
	data.hours.push({ id : data.hours.length, from : '11:10:00', to : '12:40:00' });
	data.hours.push({ id : data.hours.length, from : '13:10:00', to : '14:40:00' });
	data.hours.push({ id : data.hours.length, from : '15:00:00', to : '16:30:00' });
	data.hours.push({ id : data.hours.length, from : '16:50:00', to : '18:20:00' });
	data.hours.push({ id : data.hours.length, from : '18:30:00', to : '20:00:00' });

	var coursesSet           = {};
	var groupsSet            = {};
	var lecturersSet         = {};
	var lessonGroupRelSet    = {};
	var lessonLecturerRelSet = {};
	var lessonRoomRelSet     = {};
	var lessonSet            = {};
	var roomsSet             = {};

	for (var i = 0; i < rawData.length; i++) {
		var entry        = rawData[i];
		var course       = entry.course;
		var group        = entry.group;
		var rooms        = entry.rooms;
		var lecturers    = entry.lecturers;


		if (course in coursesSet) {
			course = coursesSet[course];
		} else {
			var id = data.courses.length;
			data.courses.push({ id : id, name : course });
			coursesSet[course] = id;
			course = id;
		}

		if (group in groupsSet) {
			group = groupsSet[group];
		} else {
			var id = data.groups.length;
			data.groups.push({ id : id, name : group });
			groupsSet[group] = id;
			group = id;
		}


		var lessonKey    = [ entry.week, entry.weekday, entry.hour, course ].join('-');
		var lessonExists = lessonKey in lessonSet;
		var lessonId;

		if (lessonExists) {
			lessonId = lessonSet[lessonKey];
		} else {
			lessonId = data.lessons.length;
			lessonSet[lessonKey] = lessonId;
		}


		if (rooms.length) {
			for (var j = 0; j < rooms.length; j++) {
				var room = rooms[j];

				if (room in roomsSet) {
					room = roomsSet[room];
				} else {
					var id = data.rooms.length;
					data.rooms.push({ id : id, name : room });
					roomsSet[room] = id;
					room = id;
				}

				var key = lessonId + '-' + room;
				if (!(key in lessonRoomRelSet)) {
					data.lessonRoomRel.push({ lesson_id : lessonId, room_id : room });
					lessonRoomRelSet[key] = 1;
				}
			}
		}

		if (lecturers.length) {
			for (var j = 0; j < lecturers.length; j++) {
				var lecturer = lecturers[j];

				if (lecturer in lecturersSet) {
					lecturer = lecturersSet[lecturer];
				} else {
					var id = data.lecturers.length;
					data.lecturers.push({ id : id, name : lecturer });
					lecturersSet[lecturer] = id;
					lecturer = id;
				}

				var key = lessonId + '-' + lecturer;
				if (!(key in lessonLecturerRelSet)) {
					data.lessonLecturerRel.push({ lesson_id : lessonId, lecturer_id : lecturer });
					lessonLecturerRelSet[key] = 1;
				}
			}
		}


		if (!lessonExists) {
			data.lessons.push({
				id        : lessonId,
				week      : entry.week,
				weekday   : entry.weekday,
				hour_id   : entry.hour,
				course_id : course,
			});
		}

		var key = lessonId + '-' + group;
		if (!(key in lessonGroupRelSet)) {
			data.lessonGroupRel.push({ lesson_id : lessonId, group_id : group });
			lessonGroupRelSet[key] = 1;
		}
	}

	var p = path.resolve(__dirname, './dist/rawa.js');
	var r = fs.writeFileSync(p, "define('rawa'," + JSON.stringify(data) + ")");

	if (!r) {
		console.log('%s successfully written!', p);
	} else {
		throw r;
	}
}
