'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.createDuckling = createDuckling;
exports.resolveDuckling = resolveDuckling;

var _reduxActions = require('redux-actions');

var _redux = require('redux');

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _toArray(arr) { return Array.isArray(arr) ? arr : Array.from(arr); }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var RESET_ACTION = 'RESET';

function flatten(ducklings) {
  return ducklings.reduce(function (ducklings, duckling) {
    if (duckling instanceof Array) {
      return [].concat(_toConsumableArray(ducklings), _toConsumableArray(flatten(duckling)));
    }
    return [].concat(_toConsumableArray(ducklings), [duckling]);
  }, []);
}

function namespaceType(namespace, type) {
  if (namespace.length > 0) {
    var _namespace = _toArray(namespace),
        key = _namespace[0],
        rest = _namespace.slice(1);

    return namespaceType(rest, key + '/' + type);
  }
  return type;
}

function focusState(namespace, state) {
  if (namespace.length > 0) {
    var _namespace2 = _toArray(namespace),
        key = _namespace2[0],
        rest = _namespace2.slice(1);

    return focusState(rest, state)[key];
  }
  return state;
}

function addSimpleResetAction(action, duckling) {
  var reset = action(RESET_ACTION);
  return _extends({}, duckling, {
    app: _extends({}, duckling.app, {
      reset: reset
    })
  });
}

function addCombinedResetAction(duckling) {
  var children = Object.keys(duckling.handlers);
  var app = duckling.app;
  return _extends({}, duckling, {
    app: _extends({}, app, {
      reset: function reset() {
        return function (dispatch) {
          children.forEach(function (child) {
            dispatch(app[child].reset());
          });
        };
      }
    })
  });
}

function addResetAction(action, duckling) {
  // determine the appropriate reset action to add
  if (duckling.handlers instanceof Array) {
    return addSimpleResetAction(action, duckling);
  }
  return addCombinedResetAction(duckling);
}

function resolveFunction(duckling, namespace, action, selector, appSoFar) {
  var _duckling = duckling({
    action: action,
    selector: selector,
    namespace: namespace,
    app: appSoFar
  }),
      _duckling$initialStat = _duckling.initialState,
      initialState = _duckling$initialStat === undefined ? {} : _duckling$initialStat,
      _duckling$handlers = _duckling.handlers,
      handlers = _duckling$handlers === undefined ? {} : _duckling$handlers,
      _duckling$app = _duckling.app,
      app = _duckling$app === undefined ? {} : _duckling$app;

  return {
    initialState: initialState,
    handlers: Object.keys(handlers).length ? [handlers] : [],
    app: app
  };
}

function resolveArray(ducklings, namespace, action, selector, initialState, handlers, app) {
  // first flatten the array so
  // that ducklings don't get added
  // multiple times because of the recursive
  // nature of this function (ie. when a
  // parent is merged and adds handlers again)
  ducklings = flatten(ducklings);
  return addResetAction(action, ducklings.reduce(function (_ref, duckling) {
    var initialState = _ref.initialState,
        handlers = _ref.handlers,
        app = _ref.app;

    duckling = mergeDuckling(duckling, namespace, action, selector, initialState, handlers, app);
    if (handlers instanceof Array) {
      if (duckling.handlers instanceof Array) {
        handlers = [].concat(_toConsumableArray(handlers), _toConsumableArray(duckling.handlers));
      } else {
        if (Object.keys(initialState).length > 0) {
          throw new Error('Cannot merge a non empty `initialState` with combined duckling');
        }
        if (handlers.length === 0) {
          handlers = duckling.handlers;
        } else {
          throw new Error('Cannot merge a non empty `handlers` with combined duckling');
        }
      }
    } else {
      if (duckling.handlers instanceof Array) {
        if (Object.keys(duckling.initialState).length > 0) {
          throw new Error('Cannot merge combined duckling with a non empty `initialState`');
        }
        if (duckling.handlers.length > 0) {
          throw new Error('Cannot merge combined duckling with a non empty `handlers`');
        }
      } else {
        handlers = _extends({}, handlers, duckling.handlers);
      }
    }
    return {
      initialState: _extends({}, initialState, duckling.initialState),
      handlers: handlers,
      app: _extends({}, app, duckling.app)
    };
  }, { initialState: initialState, handlers: handlers, app: app }));
}

function resolveObject(ducklings, namespace) {
  return Object.keys(ducklings).reduce(function (_ref2, key) {
    var initialState = _ref2.initialState,
        handlers = _ref2.handlers,
        app = _ref2.app;

    var duckling = mergeDuckling(ducklings[key], [key].concat(_toConsumableArray(namespace)));
    initialState[key] = duckling.initialState;
    handlers[key] = duckling.handlers;
    app[key] = duckling.app;
    return {
      initialState: initialState,
      handlers: handlers,
      app: app
    };
  }, { initialState: {}, handlers: {}, app: {} });
}

function mergeDuckling(duckling, namespace, action, selector) {
  var initialState = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
  var handlers = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : [];
  var app = arguments.length > 6 && arguments[6] !== undefined ? arguments[6] : {};

  action = action || function (type) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    return _reduxActions.createAction.apply(undefined, [namespaceType(namespace, type)].concat(args));
  };
  selector = selector || function (callback) {
    return function (state) {
      return callback(focusState(namespace, state));
    };
  };
  if (typeof duckling === 'function') {
    return resolveFunction(duckling, namespace, action, selector, app);
  } else if ((typeof duckling === 'undefined' ? 'undefined' : _typeof(duckling)) === 'object') {
    if (duckling instanceof Array) {
      return resolveArray(duckling, namespace, action, selector, initialState, handlers, app);
    }
    return resolveObject(duckling, namespace);
  }
  throw new Error('invalid duckling');
}

function resolveReducerArray(_ref3) {
  var initialState = _ref3.initialState,
      handlers = _ref3.handlers,
      app = _ref3.app;

  handlers.push(_defineProperty({}, app.reset, function () {
    return initialState;
  }));
  var reducers = handlers.map(function (handlers) {
    return (0, _reduxActions.handleActions)(handlers, initialState);
  });
  return {
    reducer: function reducer(state, action) {
      return reducers.reduce(function (state, reducer) {
        return reducer(state, action);
      }, state);
    },
    app: app
  };
}

function resolveReducerObject(_ref4) {
  var initialState = _ref4.initialState,
      handlers = _ref4.handlers,
      app = _ref4.app;

  return {
    reducer: (0, _redux.combineReducers)(Object.keys(handlers).reduce(function (reducers, key) {
      var _resolveReducer = resolveReducer({
        initialState: initialState[key],
        handlers: handlers[key],
        app: app[key]
      }),
          reducer = _resolveReducer.reducer;

      reducers[key] = reducer;
      return reducers;
    }, {})),
    app: app
  };
}

function resolveReducer(duckling) {
  if (duckling.handlers instanceof Array) {
    return resolveReducerArray(duckling);
  }
  return resolveReducerObject(duckling);
}

function createDuckling() {
  for (var _len2 = arguments.length, ducklings = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
    ducklings[_key2] = arguments[_key2];
  }

  return ducklings;
}

function resolveDuckling(duckling) {
  var namespace = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

  return resolveReducer(mergeDuckling(duckling, namespace));
}