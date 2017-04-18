import {
  createAction,
  handleActions,
} from 'redux-actions';
import {
  combineReducers,
} from 'redux';

const RESET_ACTION = 'RESET';

function flatten(ducklings) {
  if (ducklings instanceof Array) {
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
  return [ducklings];
}

function split(ducklings) {
  return ducklings.reduce(({maps, ducklings}, duckling) => {
    if (typeof duckling === 'function') {
      ducklings.push(duckling);
    } else if (typeof duckling === 'object') {
      maps.push(duckling);
    } else {
      throw new Error('invalid duckling');
    }
    return {
      maps,
      ducklings,
    };
  }, {maps: [], ducklings: []});
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

// add to the beginning of a chain of ducklings
// to define the reset action
function resetAction({action}) {
  return {
    app: {
      reset: action(RESET_ACTION),
    },
  };
}

// once the initial state is known, use this
// to generate a reducer to apply the reset action
function resetHandler(app, initialState) {
  return {
    [app.reset]: () => initialState,
  };
}

// add to the beginning of a chain of ducklings
// that is being merged with a map
// to define the reset action
function resetMapAction({children, app}) {
  return {
    app: {
      reset: () => (dispatch) => {
        children.forEach((child) => {
          dispatch(app[child].reset());
        });
      },
    },
  };
}

function resolveMaps(maps, namespace) {
  const {app, reducerMap} = maps.reduce(({app, reducerMap}, map) => {
    return Object.keys(map).reduce(({app, reducerMap}, key) => {
      const resolved = resolve(map[key], [key, ...namespace]);
      return {
        app: {
          [key]: resolved.app,
          ...app,
        },
        reducerMap: {
          [key]: resolved.reducer,
          ...reducerMap,
        },
      };
    }, {app, reducerMap});
  }, {app: {}, reducerMap: {}});
  return {
    app,
    reducer: combineReducers(reducerMap),
  };
}

function resolveDucklingsWithMap(
  ducklings,
  namespace,
  action,
  selector,
  app,
  children,
) {
  // prepend the map reset action duckling
  ducklings = [resetMapAction, ...ducklings];
  return ducklings.reduce((app, duckling) => {
    const {app: nextApp = {}, handlers = {}, initialState = {}} = duckling({
      namespace,
      action,
      selector,
      app,
      children,
    });
    // first ensure that handlers and initialState
    // are empty as we cannot compose a new reducer
    // with a reducer map (We could just print
    // a warning and ignore them like `combineReducers`
    // does, but I think it is better to fail straight
    // away)
    if (Object.keys(handlers).length > 0) {
      throw new Error(
        'Cannot merge non empty `handlers` with duckling map'
      );
    }
    if (Object.keys(initialState).length > 0) {
      throw new Error(
        'Cannot merge a non empty `initialState` with duckling map'
      );
    }
    return {
      ...app,
      ...nextApp,
    };
  }, app);
}

function resolveDucklings(
  ducklings,
  namespace,
  action,
  selector,
) {
  // prepend the reset action duckling
  ducklings = [resetAction, ...ducklings];
  const {app, handlersList, initialState} = ducklings.reduce(({
    app,
    handlersList,
    initialState,
  }, duckling) => {
    const {
      app: nextApp = {},
      handlers = {},
      initialState: nextInitialState = {},
    } = duckling({
      namespace,
      action,
      selector,
      app,
      children: [],
    });
    return {
      app: {
        ...app,
        ...nextApp,
      },
      handlersList: [
        ...handlersList,
        handlers,
      ],
      initialState: {
        ...initialState,
        ...nextInitialState,
      },
    };
  }, {app: {}, handlersList: [], initialState: {}});
  // prepend the reset handler and create the list of reducers
  const reducers = [
    resetHandler(app, initialState),
    ...handlersList,
  ].map((handlers) => handleActions(handlers, initialState));
  // reduce the reducers from left to right
  const reducer = (
    state,
    action,
  ) => reducers.reduce((state, reducer) => reducer(state, action), state);
  return {
    app,
    reducer,
  };
}

export default function resolve(all, namespace = []) {
  // create the action helper for this namespace
  const action = ((type, ...args) => createAction(
    namespaceType(namespace, type),
    ...args
  ));
  // create the selector helper for this namespace
  const selector = ((callback) => (state) => callback(
    focusState(namespace, state)
  ));
  // flatten the input to a single array of
  // maps and ducklings
  const flat = flatten(all);
  // extract the maps and ducklings
  const {maps, ducklings} = split(flat);
  // now merge all the maps first to resolve the children
  // if there are any
  const {app, reducer} = resolveMaps(maps, namespace);
  // set the list of children
  const children = Object.keys(app);
  // now we merge the ducklings differently
  // if we have children because ducklings
  // with children cannot have other
  // reducers
  if (children.length > 0) {
    return {
      app: resolveDucklingsWithMap(
        ducklings,
        namespace,
        action,
        selector,
        app,
        children,
      ),
      reducer,
    };
  }
  return resolveDucklings(
    ducklings,
    namespace,
    action,
    selector,
  );
}
