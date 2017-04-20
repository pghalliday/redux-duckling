'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = resolve;

var _reduxActions = require('redux-actions');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var RESET_ACTION_TYPE = 'RESET';
var RESET_ACTION_CREATOR = 'reset';

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

function createReduceHelper(app, children) {
  return function (state, actions) {
    return actions.reduce(function (state, _ref2) {
      var _app$child;

      var _ref3 = _toArray(_ref2),
          child = _ref3[0],
          action = _ref3[1],
          args = _ref3.slice(2);

      return _extends({}, state, _defineProperty({}, child, children[child](state[child], (_app$child = app[child])[action].apply(_app$child, _toConsumableArray(args)))));
    }, state);
  };
}

function combineReducers(children) {
  var keys = Object.keys(children);
  return function (state, action) {
    return keys.reduce(function (state, key) {
      return _extends({}, state, _defineProperty({}, key, children[key](state[key], action)));
    }, state);
  };
}

function createResetChildren(app, children) {
  var keys = Object.keys(children);
  return function () {
    return keys.reduce(function (state, key) {
      return _extends({}, state, _defineProperty({}, key, children[key](undefined, app[key].reset)));
    }, {});
  };
}

// add to the beginning of a chain of ducklings
// to define the reset action
function resetAction(_ref4) {
  var action = _ref4.action;

  var reset = action(RESET_ACTION_TYPE);
  return {
    app: _defineProperty({}, RESET_ACTION_CREATOR, reset)
  };
}

// once the initial state is known, use this
// to generate a reducer to apply the reset action
function createResetReducer(app, initialState, children) {
  var resetChildren = createResetChildren(app, children);
  return (0, _reduxActions.handleActions)(_defineProperty({}, app[RESET_ACTION_CREATOR], function () {
    return _extends({}, resetChildren(), initialState);
  }), {});
}

function resolveMaps(maps, namespace) {
  return maps.reduce(function (_ref5, map) {
    var app = _ref5.app,
        children = _ref5.children;

    return Object.keys(map).reduce(function (_ref6, key) {
      var app = _ref6.app,
          children = _ref6.children;

      var resolved = resolve(map[key], [key].concat(_toConsumableArray(namespace)));
      return {
        app: _extends(_defineProperty({}, key, resolved.app), app),
        children: _extends(_defineProperty({}, key, resolved.reducer), children)
      };
    }, { app: app, children: children });
  }, { app: {}, children: {} });
}

function reduceDucklings(ducklings, action, selector, reduce, app) {
  return ducklings.reduce(function (_ref7, duckling) {
    var app = _ref7.app,
        reducers = _ref7.reducers,
        initialState = _ref7.initialState;

    var _duckling = duckling({
      action: action,
      selector: selector,
      reduce: reduce,
      app: app
    }),
        _duckling$app = _duckling.app,
        nextApp = _duckling$app === undefined ? {} : _duckling$app,
        _duckling$handlers = _duckling.handlers,
        handlers = _duckling$handlers === undefined ? {} : _duckling$handlers,
        _duckling$initialStat = _duckling.initialState,
        nextInitialState = _duckling$initialStat === undefined ? {} : _duckling$initialStat;

    return {
      app: _extends({}, app, nextApp),
      reducers: [].concat(_toConsumableArray(reducers), [
      // Don't need an initial state here but
      // handle actions forces us to provide one.
      // The initial state will really be set in
      // reduceReducers
      (0, _reduxActions.handleActions)(handlers, {})]),
      initialState: _extends({}, initialState, nextInitialState)
    };
  }, { app: app, reducers: [], initialState: {} });
}

function reduceReducers(reducers, initialState) {
  return function () {
    var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : initialState;
    var action = arguments[1];
    return reducers.reduce(function (state, reducer) {
      return _extends({}, state, reducer(state, action));
    }, state);
  };
}

function resolveDucklings(ducklings, namespace, action, selector, reduce, combinedApp, children) {
  // reduce to a single app and initial state and collect
  // a list of reducer maps
  var _reduceDucklings = reduceDucklings([resetAction].concat(_toConsumableArray(ducklings)), action, selector, reduce, combinedApp),
      app = _reduceDucklings.app,
      reducers = _reduceDucklings.reducers,
      initialState = _reduceDucklings.initialState;
  // create the list of reducers prepending the combined
  // reducer for children and the reset reducer


  var resetReducer = createResetReducer(app, initialState, children);
  var combinedReducer = combineReducers(children);
  return {
    app: app,
    reducer: reduceReducers([resetReducer, combinedReducer].concat(_toConsumableArray(reducers)), initialState)
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
      children = _resolveMaps.children;
  // create the reduce helper for these children


  var reduce = createReduceHelper(app, children);
  // finally resolve the ducklings, putting the map
  // reducer and app first
  return resolveDucklings(ducklings, namespace, action, selector, reduce, app, children);
}