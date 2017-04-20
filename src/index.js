import {
  createAction,
  handleActions,
} from 'redux-actions';

const RESET_ACTION_TYPE = 'RESET';
const RESET_ACTION_CREATOR = 'reset';

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

function createActionHelper(namespace) {
  const prefix = namespace.reduce((prefix, name) => `${name}/${prefix}`, '');
  return (type, ...args) => createAction(`${prefix}${type}`, ...args);
}

function createSelectorHelper(namespace) {
  if (namespace.length > 0) {
    const selectors = namespace.map((name) => (state) => state[name]);
    const selector = selectors.reduce(
      (chain, selector) => (state) => chain(selector(state))
    );
    return (callback) => (state, ...args) => callback(selector(state), ...args);
  }
  return (callback) => (...args) => callback(...args);
}

function createReduceHelper(app, children) {
  return (state, actions) => actions.reduce((
    state,
    [child, action, ...args]
  ) => ({
    ...state,
    [child]: children[child](state[child], app[child][action](...args)),
  }), state);
}

function combineReducers(children) {
  const keys = Object.keys(children);
  return (state, action) => keys.reduce((state, key) => ({
    ...state,
    [key]: children[key](state[key], action),
  }), state);
}

function createResetChildren(app, children) {
  const keys = Object.keys(children);
  return () => keys.reduce((state, key) => ({
    ...state,
    [key]: children[key](undefined, app[key].reset),
  }), {});
}

// add to the beginning of a chain of ducklings
// to define the reset action
function resetAction({action}) {
  const reset = action(RESET_ACTION_TYPE);
  return {
    app: {
      [RESET_ACTION_CREATOR]: reset,
    },
  };
}

// once the initial state is known, use this
// to generate a reducer to apply the reset action
function createResetReducer(app, initialState, children) {
  const resetChildren = createResetChildren(app, children);
  return handleActions({
    [app[RESET_ACTION_CREATOR]]: () => ({
      ...resetChildren(),
      ...initialState,
    }),
  }, {});
}

function resolveMaps(maps, namespace) {
  return maps.reduce(({app, children}, map) => {
    return Object.keys(map).reduce(({app, children}, key) => {
      const resolved = resolve(map[key], [key, ...namespace]);
      return {
        app: {
          [key]: resolved.app,
          ...app,
        },
        children: {
          [key]: resolved.reducer,
          ...children,
        },
      };
    }, {app, children});
  }, {app: {}, children: {}});
}

function reduceDucklings(
  ducklings,
  action,
  selector,
  reduce,
  app,
) {
  return ducklings.reduce(({
    app,
    reducers,
    initialState,
  }, duckling) => {
    const {
      app: nextApp = {},
      handlers = {},
      initialState: nextInitialState = {},
    } = duckling({
      action,
      selector,
      reduce,
      app,
    });
    return {
      app: {
        ...app,
        ...nextApp,
      },
      reducers: [
        ...reducers,
        // Don't need an initial state here but
        // handle actions forces us to provide one.
        // The initial state will really be set in
        // reduceReducers
        handleActions(handlers, {}),
      ],
      initialState: {
        ...initialState,
        ...nextInitialState,
      },
    };
  }, {app, reducers: [], initialState: {}});
}

function reduceReducers(reducers, initialState) {
  return (
    state = initialState,
    action,
  ) => reducers.reduce((state, reducer) => ({
    // always merge the state as we are chaining
    // reducers and otherwise it can be difficult
    // to remember which reducer set what an in what
    // order. This way everything has to be explicit,
    // including removing things from the state, and you
    // can't accidentally remove everything in a reducer
    // that mistakenly thinks it owns the whole thing
    ...state,
    ...reducer(state, action),
  }), state);
}

function resolveDucklings(
  ducklings,
  namespace,
  action,
  selector,
  reduce,
  combinedApp,
  children,
) {
  // reduce to a single app and initial state and collect
  // a list of reducer maps
  const {app, reducers, initialState} = reduceDucklings(
    [resetAction, ...ducklings],
    action,
    selector,
    reduce,
    combinedApp,
  );
  // create the list of reducers prepending the combined
  // reducer for children and the reset reducer
  const resetReducer = createResetReducer(app, initialState, children);
  const combinedReducer = combineReducers(children);
  return {
    app,
    reducer: reduceReducers([
      resetReducer,
      combinedReducer,
      ...reducers,
    ], initialState),
  };
}

export default function resolve(all, namespace = []) {
  // create the action helper for this namespace
  const action = createActionHelper(namespace);
  // create the selector helper for this namespace
  const selector = createSelectorHelper(namespace);
  // flatten the input to a single array of
  // maps and ducklings
  const flat = flatten(all);
  // extract the maps and ducklings
  const {maps, ducklings} = split(flat);
  // now merge all the maps first to resolve the children
  // if there are any
  const {app, children} = resolveMaps(maps, namespace);
  // create the reduce helper for these children
  const reduce = createReduceHelper(app, children);
  // finally resolve the ducklings, putting the map
  // reducer and app first
  return resolveDucklings(
    ducklings,
    namespace,
    action,
    selector,
    reduce,
    app,
    children,
  );
}
