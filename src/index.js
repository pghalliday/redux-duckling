import {
  createAction,
  handleActions,
} from 'redux-actions';
import {
  combineReducers,
} from 'redux';

function namespaceType(namespace, type) {
  if (namespace.length > 0) {
    const [key, ...rest] = namespace;
    return namespaceType(rest, `${key}/${type}`);
  }
  return type;
};

function focusState(namespace, state) {
  if (namespace.length > 0) {
    const [key, ...rest] = namespace;
    return focusState(rest, state)[key];
  }
  return state;
};

function filterState(keys, state) {
  if (typeof state !== 'undefined') {
    const newState = {};
    keys.forEach((key) => {
      newState[key] = state[key];
    });
    return newState;
  }
  return state;
};

export function createDuckling(...ducklings) {
  return ducklings;
};

export function resolveDuckling(duckling, namespace = [], app = {}) {
  if (typeof duckling === 'function') {
    const action = (type, ...args) => createAction(
      namespaceType(namespace, type),
      ...args
    );
    const selector = (callback) => (state) => callback(
      focusState(namespace, state)
    );
    let initialState;
    let handlers;
    ({initialState, handlers, app} = duckling({
      action,
      selector,
      namespace,
      app,
    }));
    initialState = typeof initialState === 'undefined' ? {} : initialState;
    handlers = typeof handlers === 'undefined' ? {} : handlers;
    app = typeof app === 'undefined' ? {} : app;
    return {
      app,
      reducer: handleActions(handlers, initialState),
      initialState,
    };
  } else if (typeof duckling === 'object') {
    if (duckling instanceof Array) {
      return duckling.reduce(({app, reducer, initialState}, duckling) => {
        const {
          app: nextApp,
          reducer: nextReducer,
          initialState: nextInitialState,
        } = resolveDuckling(
          duckling,
          namespace,
          app,
        );
        initialState = {
          ...initialState,
          ...nextInitialState,
        };
        return {
          app: {
            ...app,
            ...nextApp,
          },
          reducer: (state = initialState, action) => nextReducer(
            reducer(state, action),
            action
          ),
          initialState,
        };
      }, {app: {}, reducer: (state) => state, initialState: {}});
    }
    const {app, reducers} = Object.keys(duckling).reduce(
      ({app, reducers}, key) => {
        const {app: childApp, reducer} = resolveDuckling(
          duckling[key],
          [key, ...namespace]
        );
        app[key] = childApp;
        reducers[key] = reducer;
        return {
          app,
          reducers,
        };
      }, {app: {}, reducers: {}}
    );
    return {
      app,
      // combineReducers will discard any keys it does not know about
      // so don't send them in and reconstruct the state afterward
      reducer: (state, action) => ({
        ...state,
        ...combineReducers(reducers)(
          filterState(Object.keys(reducers), state),
          action,
        ),
      }),
      initialState: {},
    };
  } else {
    throw new Error('invalid duckling');
  }
};
