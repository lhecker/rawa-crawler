(function (global, undefined) {
	var console = global.console;


	/*
	 * The module cache.
	 *
	 * Accessible from require.cache.
	 *
	 * structure:
	 * {
	 *     "module/id" : {*},
	 *     ...
	 * }
	 */
	var __modules = {};

	/*
	 * A list of modules with missing (i.e. not yet defined) dependencies.
	 *
	 * Accessible from require._pending.
	 *
	 * structure:
	 * {
	 *     "module/id" : {
	 *         a : {Array},  // argv
	 *         m : {number}, // missingDeps
	 *         f : {*}       // factory
	 *     },
	 *     ...
	 * }
	 */
	var __pending = {};

	/*
	 * Each Array, if defined at all, contains a number of tuples (description: see below),
	 * which form a list of instructions for missing modules.
	 *
	 * Accessible from require._updateOnDefine.
	 *
	 * structure:
	 * {
	 *     "module/id" : [
	 *         {string|number}, // ID of the module depending on this one
	 *         {number},        // argv position at which this module must be filled in
	 *         ...,
	 *         ...
	 *     ],
	 *     ...
	 * }
	 */
	var __updateOnDefine = {};


	/*
	 * An example as an overview:
	 * A depends on B (which has no dependencies), but B is not yet defined.
	 *
	 * Therefore A won't be saved in "modules", but a new entry in "__pending" will be created:
	 *     __pending["A"] = {
	 *         a : [ undefined ], // i.e. the placeholder for the first argument of the factory: the module B
	 *         m : 1,
	 *         f : function,
	 *     };
	 *
	 * Additionally a shit trigger in "__updateOnDefine" will be defined, in order for
	 * this algorithm to know that there is some module that is waiting for B to get defined:
	 *     __updateOnDefine["B"] = {
	 *         "A",
	 *         0
	 *     }
	 *
	 * Now B gets defined. Since there is a __updateOnDefine entry for module B, we iterate through all entries (here: only 1 tuple).
	 * It will notice that A is listed as dependency, get the corresponding entry in "__pending",
	 * set itself at position 0 in A's "argv" Array and decrement A's "missing" count.
	 * (That is turning require(["A"]) into the A in the "function (A) {}" callback.)
	 *
	 * "missing" will now be 0 (i.e. all missing positions in argv are filled in) and the factory of A gets executed.
	 *
	 * After that the algorithm will of course recursively check if there is a __updateOnDefine["A"] and proceed accordingly.
	 */



	/*
	 * require() internally uses define() but with numbers as IDs instead of strings.
	 */
	var __guid = 0;

	/*
	 * You can fill __execBlocker with module IDs. micro.require.js will block the execution
	 * of all factories except the ones in this list until all modules in this list are loaded.
	 */
	var __execBlocker = [];

	var __execBlockerStack = [];


	/**
	 * Prints a warning message to the console.
	 *
	 * @param {...*} var_args
	 */
	function warn(var_args) {
		if (console) {
			console.warn.apply(console, arguments);
		}
	}


	/**
	 * shortcut for testing if a module with "id" is a real module or just a fantasy.
	 * Err... I mean a virtual require() module with a numeric ID.
	 *
	 * @param {number|string} id  module id
	 */
	function isModule(id) {
		return isNaN(id);
	}

	/**
	 * Executes factory if it's a function, or else it simply returns it.
	 * Returns undefined if "factory" is actually a define() callback.
	 *
	 * @param {number|string} id       module id
	 * @param {*}             factory  the module factory
	 * @param {Array}         argv     arguments to be applied
	 * @return {*}
	 */
	function execFactory(id, factory, argv) {
		if (typeof factory === 'function') {
			factory = factory.apply(global, argv);
		}

		if (isModule(id)) {
			if (!factory) {
				warn('"' + id + '" evaluated to', factory);
			}

			return factory;
		}
	}

	/**
	 * Recursively executed modules.
	 * E.g. A depends on B, which in turn depends on C.
	 *      => C must be executed first, after that B and finally A.
	 *
	 * @param {number|string} curId    module id
	 * @param {*}             factory  obvious
	 * @param {Array}         argv     the arguments to be applied on the factory
	 */
	function exec(curId, factory, argv) {
		var curModule = execFactory(curId, factory, argv);

		// require() uses define() internally with a numeric ID
		if (isModule(curId)) {
			var stack = [ [curId, curModule] ];
			var resolvedId;
			var resolvedModule;
			var updateList;
			var i;

			__modules[curId] = curModule;

			while (resolvedModule = stack.pop()) {
				resolvedId = resolvedModule[0];
				resolvedModule = resolvedModule[1];

				if (updateList = __updateOnDefine[resolvedId]) {
					for (i = 0; i < updateList.length; /* every access below will increment i */) {
						curId = updateList[i++];
						curModule = __pending[curId];
						argv = curModule.a;

						argv[updateList[i++]] = resolvedModule;

						if (--curModule.m <= 0) {
							factory = curModule.f;
							curModule = execFactory(curId, factory, argv);

							if (isModule(curId)) {
								__modules[curId] = curModule;

								stack.push([curId, curModule]);
							}

							delete __pending[curId];
						}
					}

					delete __updateOnDefine[resolvedId];
				}
			}
		}
	}

	/**
	 * Defines a new module. See AMD specs. Does not support anonymous modules.
	 *
	 * @param {number|string}   id
	 * @param {Arguments|Array} deps
	 * @param {*=}              factory
	 */
	function define(id, deps, factory) {
		if (factory === undefined) {
			factory = deps;
			deps = undefined;
		}

		if (id in __modules) {
			warn('"' + id + '" already defined');
			return;
		}


		var missingDeps = 0;
		var argv = [];


		if (deps) {
			var depsLength = deps.length;
			var depId;

			argv.length = depsLength;

			for (var i = 0; i < depsLength; i++) {
				depId = deps[i];

				/*
				 * Passing through non-strings allows us to create factories and dynamically "schedule"
				 * modules for asynchronous execution, after all their dependencies are available.
				 *
				 * E.g.: You wan't to bootstrap client side rendering widgets with it's initial parameters
				 * (assuming that every widget has a associated module defined):
				 *   function factory(module, widget) { module.call(window, widget); }
				 *   window.add = function (name, parameters) { require(['widget/' + name, widget], factory); }
				 *
				 *   <div id="foobar">...</div>
				 *   <script>add("foobar", { initialParameters });
				 *
				 * With the above code the widget will be asynchronously initialized as soon as it's module "widget/foobar" is defined.
				 */
				if (typeof depId === 'string') {
					if (depId in __modules) {
						argv[i] = __modules[depId];
					} else {
						(__updateOnDefine[depId] || (__updateOnDefine[depId] = [])).push(id, i);

						missingDeps++;
					}
				} else {
					argv[i] = depId;
				}
			}
		}


		if (missingDeps) {
			__pending[id] = {
				a : argv,
				m : missingDeps,
				f : factory
			};
		} else {
			// see definition of __execBlocker for a dexcription
			missingDeps = __execBlocker.length;

			if (missingDeps) {
				var idx = __execBlocker.indexOf(id);

				if (~idx) {
					__execBlocker.splice(idx, 1);

					if (missingDeps === 1) {
						while (argv = __execBlockerStack.shift()) {
							exec.apply(global, argv);
						}
					}
				} else {
					__execBlockerStack.push([id, factory, argv]);
				}
			} else {
				exec(id, factory, argv);
			}
		}
	}

	/**
	 * Asynchonously require modules.
	 *
	 * @param {!String|Arguments|Array} deps  the requested dependencies
	 * @param {function(...)}           cb    the optional require() callback
	 */
	function require(deps, cb) {
		if (cb) {
			define(__guid++, deps, cb);
		} else if (deps in __modules) {
			return __modules[deps];
		} else {
			var msg = '"' + deps + '" missing ';
			var pending = pendingDependencies()[deps];

			if (pending) {
				msg += JSON.stringify(pending);
			}

			throw new Error(msg);
		}
	}

	/**
	 * This function maps the associative Object "__updateOnDefine"
	 * to "__pending", while switching key and value.
	 * I.e.: the ID value of the list of a __pending entry is the new key and
	 * the original key to this __pending entry will be added as a value.
	 */
	function pendingDependencies() {
		var pending = {};
		var key;
		var list;
		var i;
		var id;

		for (key in __updateOnDefine) {
			list = __updateOnDefine[key];

			for (i = 0; i < list.length; i += 2) {
				id = list[i];
				(pending[id] || (pending[id] = [])).push(key);
			}
		}

		return pending;
	}

	function report() {
		/*
		 * Assuming that every browser who supports the "modern" feature of
		 * console.groupCollapsed() also supports .log() and .warn().
		 */
		if (console && console.groupCollapsed) {
			var pending = pendingDependencies();
			var key;

			for (key in pending) {
				warn('"' + key + '" waiting for ' + JSON.stringify(pending[key]));

				if (!isModule(key)) {
					console.groupCollapsed();
					console.log('' + __pending[key].f);
					console.groupEnd();
				}
			}
		}
	}


	/** @expose */
	define.amd = {
		/** @expose */
		jQuery : true
	};


	/** @expose */
	require.cache = __modules;

	/** @expose */
	require.execBlocker = __execBlocker;

	/** @expose */
	require.report = report;


	/** @expose */
	require._pending = __pending;

	/** @expose */
	require._updateOnDefine = __updateOnDefine;


	global['define'] = define;
	global['require'] = require;
})(window);