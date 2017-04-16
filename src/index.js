import {
  createAction,
  handleActions,
} from 'redux-actions';
import {
  combineReducers,
} from 'redux';

const RESET_ACTION = 'RESET';

function flatten(ducklings) {
  return ducklings.reduce((ducklings, duckling) => {
    if (duckling instanceof Array) {
      return [
        ...ducklings,
        ...flatten(duckling),
      ];
    }
    return [
      ...ducklings,
      duckling,
    ];
  }, []);
}

function namespaceType(namespace, type) {
  if (namespace.length > 0) {
    const [key, ...rest] = namespace;
    return namespaceType(rest, `${key}/${type}`);
  }
  return type;
}

function focusState(namespace, state) {
  if (namespace.length > 0) {
    const [key, ...rest] = namespace;
    return focusState(rest, state)[key];
  }
  return state;
}

function addSimpleResetAction(action, duckling) {
  const reset = action(RESET_ACTION);
  return {
    ...duckling,
    app: {
      ...duckling.app,
      reset,
    },
  };
}

function addCombinedResetAction(duckling) {
  const children = Object.keys(duckling.handlers);
  const app = duckling.app;
  return {
    ...duckling,
    app: {
      ...app,
      reset: () => (dispatch) => {
        children.forEach((child) => {
          dispatch(app[child].reset());
        });
      },
    },
  };
}

function addResetAction(action, duckling) {
  // determine the appropriate reset action to add
  if (duckling.handlers instanceof Array) {
    return addSimpleResetAction(action, duckling);
  }
  return addCombinedResetAction(duckling);
}

function resolveFunction(duckling, namespace, action, selector, appSoFar) {
  let {initialState = {}, handlers = {}, app = {}} = duckling({
    action,
    selector,
    namespace,
    app: appSoFar,
  });
  return {
    initialState,
    handlers: Object.keys(handlers).length ? [handlers] : [],
    app,
  };
}

function resolveArray(
  ducklings,
  namespace,
  action,
  selector,
  initialState,
  handlers,
  app
) {
  // first flatten the array so
  // that ducklings don't get added
  // multiple times because of the recursive
  // nature of this function (ie. when a
  // parent is merged and adds handlers again)
  ducklings = flatten(ducklings);
  return addResetAction(action, ducklings.reduce(({
    initialState,
    handlers,
    app,
  }, duckling) => {
    duckling = mergeDuckling(
      duckling,
      namespace,
      action,
      selector,
      initialState,
      handlers,
      app
    );
    if (handlers instanceof Array) {
      if (duckling.handlers instanceof Array) {
        handlers = [
          ...handlers,
          ...duckling.handlers,
        ];
      } else {
        if (Object.keys(initialState).length > 0) {
          throw new Error(
            'Cannot merge a non empty `initialState` with combined duckling'
          );
        }
        if (handlers.length === 0) {
          handlers = duckling.handlers;
        } else {
          throw new Error(
            'Cannot merge a non empty `handlers` with combined duckling'
          );
        }
      }
    } else {
      if (duckling.handlers instanceof Array) {
        if (Object.keys(duckling.initialState).length > 0) {
          throw new Error(
            'Cannot merge combined duckling with a non empty `initialState`'
          );
        }
        if (duckling.handlers.length > 0) {
          throw new Error(
            'Cannot merge combined duckling with a non empty `handlers`'
          );
        }
      } else {
        handlers = {
          ...handlers,
          ...duckling.handlers,
        };
      }
    }
    return {
      initialState: {
        ...initialState,
        ...duckling.initialState,
      },
      handlers,
      app: {
        ...app,
        ...duckling.app,
      },
    };
  }, {initialState, handlers, app}));
}

function resolveObject(ducklings, namespace) {
  return Object.keys(ducklings).reduce(
    ({initialState, handlers, app}, key) => {
      const duckling = mergeDuckling(
        ducklings[key],
        [key, ...namespace],
      );
      initialState[key] = duckling.initialState;
      handlers[key] = duckling.handlers;
      app[key] = duckling.app;
      return {
        initialState,
        handlers,
        app,
      };
    },
    {initialState: {}, handlers: {}, app: {}},
  );
}

function mergeDuckling(
  duckling,
  namespace,
  action,
  selector,
  initialState = {},
  handlers = [],
  app = {}
) {
  action = action || ((type, ...args) => createAction(
    namespaceType(namespace, type),
    ...args
  ));
  selector = selector || ((callback) => (state) => callback(
    focusState(namespace, state)
  ));
  if (typeof duckling === 'function') {
    return resolveFunction(duckling, namespace, action, selector, app);
  } else if (typeof duckling === 'object') {
    if (duckling instanceof Array) {
      return resolveArray(
        duckling,
        namespace,
        action,
        selector,
        initialState,
        handlers,
        app
      );
    }
    return resolveObject(duckling, namespace);
  }
  throw new Error('invalid duckling');
}

function resolveReducerArray({initialState, handlers, app}) {
  handlers.push({
    [app.reset]: () => initialState,
  });
  const reducers = handlers.map(
    (handlers) => handleActions(handlers, initialState),
  );
  return {
    reducer: (state, action) => reducers.reduce(
      (state, reducer) => reducer(state, action),
      state,
    ),
    app,
  };
}

function resolveReducerObject({initialState, handlers, app}) {
  return {
    reducer: combineReducers(Object.keys(handlers).reduce((reducers, key) => {
      const {reducer} = resolveReducer({
        initialState: initialState[key],
        handlers: handlers[key],
        app: app[key],
      });
      reducers[key] = reducer;
      return reducers;
    }, {})),
    app,
  };
}

function resolveReducer(duckling) {
  if (duckling.handlers instanceof Array) {
    return resolveReducerArray(duckling);
  }
  return resolveReducerObject(duckling);
}

export function createDuckling(...ducklings) {
  return ducklings;
}

export function resolveDuckling(duckling, namespace = []) {
  return resolveReducer(mergeDuckling(duckling, namespace));
}
