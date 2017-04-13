'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.createDuckling = createDuckling;
exports.resolveDuckling = resolveDuckling;

var _reduxActions = require('redux-actions');

var _redux = require('redux');

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

function namespaceType(namespace, type) {
  if (namespace.length > 0) {
    var _namespace = _toArray(namespace),
        key = _namespace[0],
        rest = _namespace.slice(1);

    return namespaceType(rest, key + '/' + type);
  }
  return type;
};

function focusState(namespace, state) {
  if (namespace.length > 0) {
    var _namespace2 = _toArray(namespace),
        key = _namespace2[0],
        rest = _namespace2.slice(1);

    return focusState(rest, state)[key];
  }
  return state;
};

function filterState(keys, state) {
  if (typeof state !== 'undefined') {
    var newState = {};
    keys.forEach(function (key) {
      newState[key] = state[key];
    });
    return newState;
  }
  return state;
};

function createDuckling() {
  for (var _len = arguments.length, ducklings = Array(_len), _key = 0; _key < _len; _key++) {
    ducklings[_key] = arguments[_key];
  }

  return ducklings;
};

function resolveDuckling(duckling) {
  var namespace = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
  var app = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  if (typeof duckling === 'function') {
    var action = function action(type) {
      for (var _len2 = arguments.length, args = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }

      return _reduxActions.createAction.apply(undefined, [namespaceType(namespace, type)].concat(args));
    };
    var selector = function selector(callback) {
      return function (state) {
        return callback(focusState(namespace, state));
      };
    };
    var initialState = void 0;
    var handlers = void 0;

    var _duckling = duckling({
      action: action,
      selector: selector,
      namespace: namespace,
      app: app
    });

    initialState = _duckling.initialState;
    handlers = _duckling.handlers;
    app = _duckling.app;

    initialState = typeof initialState === 'undefined' ? {} : initialState;
    handlers = typeof handlers === 'undefined' ? {} : handlers;
    app = typeof app === 'undefined' ? {} : app;
    return {
      app: app,
      reducer: (0, _reduxActions.handleActions)(handlers, initialState),
      initialState: initialState
    };
  } else if ((typeof duckling === 'undefined' ? 'undefined' : _typeof(duckling)) === 'object') {
    if (duckling instanceof Array) {
      return duckling.reduce(function (_ref, duckling) {
        var app = _ref.app,
            _reducer = _ref.reducer,
            initialState = _ref.initialState;

        var _resolveDuckling = resolveDuckling(duckling, namespace, app),
            nextApp = _resolveDuckling.app,
            nextReducer = _resolveDuckling.reducer,
            nextInitialState = _resolveDuckling.initialState;

        initialState = _extends({}, initialState, nextInitialState);
        return {
          app: _extends({}, app, nextApp),
          reducer: function reducer() {
            var state = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : initialState;
            var action = arguments[1];
            return nextReducer(_reducer(state, action), action);
          },
          initialState: initialState
        };
      }, { app: {}, reducer: function reducer(state) {
          return state;
        }, initialState: {} });
    }

    var _Object$keys$reduce = Object.keys(duckling).reduce(function (_ref2, key) {
      var app = _ref2.app,
          reducers = _ref2.reducers;

      var _resolveDuckling2 = resolveDuckling(duckling[key], [key].concat(_toConsumableArray(namespace))),
          childApp = _resolveDuckling2.app,
          reducer = _resolveDuckling2.reducer;

      app[key] = childApp;
      reducers[key] = reducer;
      return {
        app: app,
        reducers: reducers
      };
    }, { app: {}, reducers: {} }),
        _app = _Object$keys$reduce.app,
        reducers = _Object$keys$reduce.reducers;

    return {
      app: _app,
      // combineReducers will discard any keys it does not know about
      // so don't send them in and reconstruct the state afterward
      reducer: function reducer(state, action) {
        return _extends({}, state, (0, _redux.combineReducers)(reducers)(filterState(Object.keys(reducers), state), action));
      },
      initialState: {}
    };
  } else {
    throw new Error('invalid duckling');
  }
};