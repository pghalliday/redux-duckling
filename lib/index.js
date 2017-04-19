'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = resolve;

var _reduxActions = require('redux-actions');

var _redux = require('redux');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var RESET_ACTION = 'RESET';

function flatten(ducklings) {
  if (ducklings instanceof Array) {
    return ducklings.reduce(function (ducklings, duckling) {
      if (duckling instanceof Array) {
        return [].concat(_toConsumableArray(ducklings), _toConsumableArray(flatten(duckling)));
      }
      return [].concat(_toConsumableArray(ducklings), [duckling]);
    }, []);
  }
  return [ducklings];
}

function split(ducklings) {
  return ducklings.reduce(function (_ref, duckling) {
    var maps = _ref.maps,
        ducklings = _ref.ducklings;

    if (typeof duckling === 'function') {
      ducklings.push(duckling);
    } else if ((typeof duckling === 'undefined' ? 'undefined' : _typeof(duckling)) === 'object') {
      maps.push(duckling);
    } else {
      throw new Error('invalid duckling');
    }
    return {
      maps: maps,
      ducklings: ducklings
    };
  }, { maps: [], ducklings: [] });
}

function createActionHelper(namespace) {
  var prefix = namespace.reduce(function (prefix, name) {
    return name + '/' + prefix;
  }, '');
  return function (type) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    return _reduxActions.createAction.apply(undefined, ['' + prefix + type].concat(args));
  };
}

function createSelectorHelper(namespace) {
  if (namespace.length > 0) {
    var selectors = namespace.map(function (name) {
      return function (state) {
        return state[name];
      };
    });
    var selector = selectors.reduce(function (chain, selector) {
      return function (state) {
        return chain(selector(state));
      };
    });
    return function (callback) {
      return function (state) {
        for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
          args[_key2 - 1] = arguments[_key2];
        }

        return callback.apply(undefined, [selector(state)].concat(args));
      };
    };
  }
  return function (callback) {
    return function () {
      return callback.apply(undefined, arguments);
    };
  };
}

// add to the beginning of a chain of ducklings
// to define the reset action
function resetAction(_ref2) {
  var action = _ref2.action;

  return {
    app: {
      reset: action(RESET_ACTION)
    }
  };
}

// once the initial state is known, use this
// to generate a reducer to apply the reset action
function resetHandler(app, initialState) {
  return _defineProperty({}, app.reset, function () {
    return initialState;
  });
}

// add to the beginning of a chain of ducklings
// that is being merged with a map
// to define the reset action
function resetMapAction(_ref4) {
  var children = _ref4.children,
      app = _ref4.app;

  return {
    app: {
      reset: function reset() {
        return function (dispatch) {
          children.forEach(function (child) {
            dispatch(app[child].reset());
          });
        };
      }
    }
  };
}

function resolveMaps(maps, namespace) {
  var _maps$reduce = maps.reduce(function (_ref5, map) {
    var app = _ref5.app,
        reducerMap = _ref5.reducerMap;

    return Object.keys(map).reduce(function (_ref6, key) {
      var app = _ref6.app,
          reducerMap = _ref6.reducerMap;

      var resolved = resolve(map[key], [key].concat(_toConsumableArray(namespace)));
      return {
        app: _extends(_defineProperty({}, key, resolved.app), app),
        reducerMap: _extends(_defineProperty({}, key, resolved.reducer), reducerMap)
      };
    }, { app: app, reducerMap: reducerMap });
  }, { app: {}, reducerMap: {} }),
      app = _maps$reduce.app,
      reducerMap = _maps$reduce.reducerMap;

  return {
    app: app,
    reducer: (0, _redux.combineReducers)(reducerMap)
  };
}

function resolveDucklingsWithMap(ducklings, namespace, action, selector, app, children) {
  // prepend the map reset action duckling
  ducklings = [resetMapAction].concat(_toConsumableArray(ducklings));
  return ducklings.reduce(function (app, duckling) {
    var _duckling = duckling({
      namespace: namespace,
      action: action,
      selector: selector,
      app: app,
      children: children
    }),
        _duckling$app = _duckling.app,
        nextApp = _duckling$app === undefined ? {} : _duckling$app,
        _duckling$handlers = _duckling.handlers,
        handlers = _duckling$handlers === undefined ? {} : _duckling$handlers,
        _duckling$initialStat = _duckling.initialState,
        initialState = _duckling$initialStat === undefined ? {} : _duckling$initialStat;
    // first ensure that handlers and initialState
    // are empty as we cannot compose a new reducer
    // with a reducer map (We could just print
    // a warning and ignore them like `combineReducers`
    // does, but I think it is better to fail straight
    // away)


    if (Object.keys(handlers).length > 0) {
      throw new Error('Cannot merge non empty `handlers` with duckling map');
    }
    if (Object.keys(initialState).length > 0) {
      throw new Error('Cannot merge a non empty `initialState` with duckling map');
    }
    return _extends({}, app, nextApp);
  }, app);
}

function resolveDucklings(ducklings, namespace, action, selector) {
  // prepend the reset action duckling
  ducklings = [resetAction].concat(_toConsumableArray(ducklings));

  var _ducklings$reduce = ducklings.reduce(function (_ref7, duckling) {
    var app = _ref7.app,
        handlersList = _ref7.handlersList,
        initialState = _ref7.initialState;

    var _duckling2 = duckling({
      namespace: namespace,
      action: action,
      selector: selector,
      app: app,
      children: []
    }),
        _duckling2$app = _duckling2.app,
        nextApp = _duckling2$app === undefined ? {} : _duckling2$app,
        _duckling2$handlers = _duckling2.handlers,
        handlers = _duckling2$handlers === undefined ? {} : _duckling2$handlers,
        _duckling2$initialSta = _duckling2.initialState,
        nextInitialState = _duckling2$initialSta === undefined ? {} : _duckling2$initialSta;

    return {
      app: _extends({}, app, nextApp),
      handlersList: [].concat(_toConsumableArray(handlersList), [handlers]),
      initialState: _extends({}, initialState, nextInitialState)
    };
  }, { app: {}, handlersList: [], initialState: {} }),
      app = _ducklings$reduce.app,
      handlersList = _ducklings$reduce.handlersList,
      initialState = _ducklings$reduce.initialState;
  // prepend the reset handler and create the list of reducers


  var reducers = [resetHandler(app, initialState)].concat(_toConsumableArray(handlersList)).map(function (handlers) {
    return (0, _reduxActions.handleActions)(handlers, initialState);
  });
  // reduce the reducers from left to right
  var reducer = function reducer(state, action) {
    return reducers.reduce(function (state, reducer) {
      return _extends({}, state, reducer(state, action));
    }, state);
  };
  return {
    app: app,
    reducer: reducer
  };
}

function resolve(all) {
  var namespace = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  // create the action helper for this namespace
  var action = createActionHelper(namespace);
  // create the selector helper for this namespace
  var selector = createSelectorHelper(namespace);
  // flatten the input to a single array of
  // maps and ducklings
  var flat = flatten(all);
  // extract the maps and ducklings

  var _split = split(flat),
      maps = _split.maps,
      ducklings = _split.ducklings;
  // now merge all the maps first to resolve the children
  // if there are any


  var _resolveMaps = resolveMaps(maps, namespace),
      app = _resolveMaps.app,
      reducer = _resolveMaps.reducer;
  // set the list of children


  var children = Object.keys(app);
  // now we merge the ducklings differently
  // if we have children because ducklings
  // with children cannot have other
  // reducers
  if (children.length > 0) {
    return {
      app: resolveDucklingsWithMap(ducklings, namespace, action, selector, app, children),
      reducer: reducer
    };
  }
  return resolveDucklings(ducklings, namespace, action, selector);
}