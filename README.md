# redux-duckling

[![Build Status](https://travis-ci.org/pghalliday/redux-duckling.svg?branch=master)](https://travis-ci.org/pghalliday/redux-duckling)
[![Build status](https://ci.appveyor.com/api/projects/status/1r6j44rxnf42t36r/branch/master?svg=true)](https://ci.appveyor.com/project/pghalliday/redux-duckling/branch/master)
[![Coverage Status](https://coveralls.io/repos/github/pghalliday/redux-duckling/badge.svg?branch=master)](https://coveralls.io/github/pghalliday/redux-duckling?branch=master)

Composable ducklings

## Motivation

After adopting the [redux duck](https://github.com/erikras/ducks-modular-redux) approach to create a more scalable architecture for our [Redux](http://redux.js.org/) application, we soon found ourselves repeating the same [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete) patterns for different collections.

Although the collections were separated in the UI and as a result existed with separate states in the Redux store, they were essentially identical in implementation. All collections could be fetched and listed. All collections could be added to or have entries removed or updated.

We had a standard pattern of actions to handle these cases and standard patterns for services that implemented the backend updates. There was a clear need to refactor into generic components that could be extended and reused.

The `redux-duckling` library implements an approach that effectively manages namespacing, composing and combining reusable duck-like modules, which due to their smaller nature we refer to as ducklings.

## Usage

```
npm install --save redux redux-actions redux-duckling
```

Note that `redux-duckling` is peer-dependent on [`redux-actions`](https://www.npmjs.com/package/redux-actions) and [`redux`](https://www.npmjs.com/package/redux).

```javascript
import resolve from 'redux-duckling';
```

A duckling is a variation on the [redux duck](https://github.com/erikras/ducks-modular-redux) pattern. It encapsulates the same principles but steps away from the ES6 module as the basic unit of reuse. It also adds selectors into the pattern as a best practice to associate selectors with reducers.

A duckling is defined using a function that returns a descriptor containing the `initialState`, the action `handlers`, and an `app` object to export the actions and selectors.

The function takes 1 argument containing helper functions and properties that facilitate duckling reuse, etc.

Define a duckling...

```javascript
function duckling({
  // The `action` helper function should be used to
  // create actions so that they are properly namespaced,
  // Internally this uses the `createAction` function from
  // `redux-actions`
  action,
  // The `selector` helper function should be used to
  // create selectors so that they operate on the
  // correct child state
  selector,
  // The `app` object provides access to actions and selectors
  // defined in the ducklings that this duckling extends.
  // At the very least this will contain a `reset` action
  // as all ducklings will resolve with a `reset` action
  // that restores the initial state.
  app,
  // The `namespace` array defines the current namespace.
  // The current leaf name will be first, the parent second,
  // etc.
  namespace,
  // The `children` array lists the names of the child
  // ducklings if there are any
  children,
}) {
  const initialState = {
    myField: undefined,
  };
  const myAction = action('MY_ACTION');
  const mySelector = selector((state) => state.myField);
  // Internally, the `handlers` object  and merged `initialState`
  // will be used to generate a reducer using the `handleActions`
  // function from `redux-actions`
  // Note that as we don't know what other handlers in the chain
  // might be doing, the return from these handlers will always 
  // be merged with the current state. This means that if you want
  // to remove any field from the state it is not enough to simply
  // omit it. It must be explicitly set to undefined.
  const handlers = {
    [myAction]: (state, action) => ({
      myField: action.payload,
    }),
  };
  return {
    initialState,
    handlers,
    // Always return a new app object, don't
    // change the helpers. This app object
    // will be merged when the duckling is resolved
    app: {
      mySelector,
      myAction,
    },
  };
}
```

Compose ducklings...

```javascript
// The following ducklings will be merged by
// merging their `initialState` and `app` objects
// and chaining their reducers from left to right
const duckling = [
  duckling1,
  duckling2,
  duckling3,
];
```

Combine ducklings...

```javascript
// The following ducklings will be combined
// so that the resulting duckling will have
// correspondingly named child ducklings.
// The resulting actions and selectors will
// be correctly namespaced according to the
// hierarchy.
// Internally the reducer will be resolved
// using the `combineReducers` function from
// `redux`.
const duckling = {
  duckling1,
  duckling2,
  duckling3,
};
```

Resolve a duckling...

```javascript
// The following call resolves a duckling to a single
// app object and reducer.
const {app, reducer} = resolve(duckling);

// A namespace parameter can optionally be provided (it
// defaults to `[]`) and can be used to resolve a duckling that
// will not be used at the root of a store.
// Remember that the namespace is an array in reverse order with
// the current leaf name first. Also remember that it will be
// used to namespace and filter the actions and selectors (as such
// it has to match the actual location in the state hierarchy).
const {app, reducer} = resolve(duckling, ['path2', 'path1']);
```

## Example

Let's look at how we might implement our CRUD example with asynchronous list, create, update and remove functions.

The flow we are going for will be something like this.

- Initially fetch the list and display it or display an error where the list would have been
- To create an entry, open a dialog
- Submit the entry and somehow indicate pending
  - on error display the error in the create dialog and allow the user to try again
  - on success close the dialog and add the new entry to the list
- To update an entry, display a dialog
- Submit the entry to be updated and somehow indicate pending
  - on error display the error in the update dialog and allow the user to try again
  - on success close the dialog and update the entry in the list
- To remove an entry, display a dialog to confirm removal
- Submit the entry to be removed and somehow indicate pending
  - on error display the error in the confirm dialog and allow the user to try again
  - on success close the dialog and remove the entry from the list

First we can demonstrate how to capture shared asynchronous behaviour in an `asyncBehavior` duckling. We know that all actions will go through 3 possible states: pending, success and error. Of these states, pending and error will look the same for all 4 functions.

```javascript
// we will use reselect to compose selectors
import {
  createSelector,
} from 'reselect';

// we will use a combination of `redux-thunk` and
// `redux-promise` for asynchronous actions
import {
  thunk,
} from 'redux-thunk';
import {
  promise,
} from 'redux-promise';

// and of course we are using `redux`
import {
  createStore,
  applyMiddleware,
} from 'redux';

// we have our own service to abstract the back end
// asynchronous operations using promises. When we create
// our redux store we will also apply the `redux-thunk`
// and `redux-promise` middlewares
import * as service from '../../service';

const asyncBehavior = ({action, selector}) => {
  const initialState = {
    pending: false,
    error: undefined,
  };

  const error = selector((state) => state.error);
  const isPending = selector((state) => state.pending);

  // Additional selectors can be constructed using libraries like
  // reselect that depend on selectors created with the `selector` helper.
  // As these selectors are not created until the duckling is resolved
  // the selectors should be safe and not conflict with each other's
  // states if the duckling is reused (at least before it has been resolved).
  const hasError = createSelector(
    error,
    (error) => typeof error !== 'undefined',
  );
  const getErrorText = createSelector(
    hasError,
    error,
    (hasError, error) => hasError ? error.toString() : '',
  );

  const start = action('START');
  const complete = action('COMPLETE');

  const handlers = {
    [start]: (state) => ({
      pending: true,
      error: undefined,
    }),
    [complete]: (state, {payload: error, error: hasError}) => hasError ? {
      pending: false,
      error,
    } : {
      pending: false,
    },
  };

  return {
    initialState,
    handlers,
    app: {
      isPending,
      hasError,
      getErrorText,
      start,
      complete,
    },
  };
};
```

### Composing ducklings

We can use this `asyncBehavior` to create a `list` duckling. Ducklings can be composed by listing them in an array, the `resolve` method then populates the `app` helper property to provide access to the already resolved `app`. It also merges the `initialState` and sequences the reducers from left to right.

```javascript
const list = [asyncBehavior, ({
  app: {start, complete},
  selector,
  namespace: [_, collection],
}) => {
  const initialState = {
    entries: [],
  };

  const getEntries = selector((state) => state.entries);

  const create = action('CREATE');
  const remove = action('REMOVE');
  const update = action('UPDATE');

  const fetch = () => (dispatch) => {
    dispatch(start());
    return dispatch(complete(
      service.list(collection),
    ));
  };

  const handlers = {
    [start]: (state) => ({
      entries: [],
    }),
    [complete]: (state, {payload: entries, error}) => error ? state : {
      entries,
    },
    [create]: (state, {payload: entry}) => ({
      entries: [
        ...state.entries,
        entry,
      ],
    }),
    [update]: (state, {payload: entry}) => ({
      entries: state.entries.map(
        (compare) => entry.id === compare.id ? entry : compare
      ),
    }),
    [remove]: (state, {payload: entry}) => ({
      entries: state.entries.filter((compare) => entry.id !== compare.id),
    }),
  };

  // We will override the `asyncBehavior` 
  // exports that should not be used externally.
  // Effectively making them private.
  return {
    initialState,
    handlers,
    app: {
      start: undefined,
      complete: undefined,
      fetch,
      getEntries,
      create,
      update,
      remove,
    },
  };
}];
```

Noting that `create`, `update` and `remove` operations all follow the same pattern, we can compose a generic `operation` duckling that also extends the `asyncBehavior`.

```javascript
const operation = [asyncBehavior, ({
  app: {start, complete},
  selector,
  namespace: [operation, collection],
}) => {
  const initialState = {
    complete: false,
    entry: undefined,
  };

  const getEntry = selector((state) => state.entry);
  const isComplete = selector((state) => state.complete);

  const submit = (entry) => (dispatch) => {
    dispatch(start(entry));
    return dispatch(complete(
      service[operation](collection, entry),
    ));
  };

  const handlers = {
    [start]: (state, {payload: entry}) => ({
      entry,
    }),
    [complete]: (state, {error}) => error ? state : {
      complete: true,
    },
  };

  return {
    initialState,
    handlers,
    app: {
      start: undefined,
      complete: undefined,
      getEntry,
      isComplete,
      submit,
    },
  };
}];
```

### Combining ducklings

Ducklings can be combined much like reducers, by assigning them to child paths of a parent state using an object mapping.

In fact this does eventually combine the reducers with `redux.combineReducers` when they are resolved. However, it also wraps the selectors so that they operate on the child state and sets the action types to namespace them according to the ducks standard.

For our example we have our `operation` functionality and can start combining it into a generic `collection` duckling. This will contain the `list`, the operations and the finalize operation actions.

**NB. it is not possible to merge other `handlers` or `initialState` with a combined duckling. If you attempt to do so an error will be thrown. This is because in most cases the states will conflict and although it might be possible to manage this, doing so quickly gets mind bogglingly complicated. This is the reason that the `list` duckling is defined separately (you may think that it would naturally sit at the collection level)**

```javascript
const collection = [{
  list,
  create: operation,
  update: operation,
  remove: operation,
}, ({
  app,
}) => {
  // Here we are using the `reset` actions that
  // are always added to ducklings as a convenience
  const finalizeCreate = (entry) => (dispatch) => {
    dispatch(app.create.reset());
    dispatch(app.list.create(entry));
  };
  const finalizeUpdate = (entry) => (dispatch) => {
    dispatch(app.update.reset());
    dispatch(app.list.update(entry));
  };
  const finalizeRemove = (entry) => (dispatch) => {
    dispatch(app.remove.reset());
    dispatch(app.list.remove(entry));
  };

  return {
    app: {
      finalizeCreate,
      finalizeRemove,
      finalizeUpdate,
    },
  };
}];
```

And we're there! Now a number of collections can be defined in the state that share this set of behaviors

```javascript
const duckling = {
  fruits: collection,
  vegetables: collection,
};
```

### Resolving the reducer and app

After combining and composing ducklings the reducer and app still need to be resolved before they can be used.

```javascript
const {reducer, app} = resolve(duckling);
const store = createStore(
  reducer,
  applyMiddleware(
    thunk,
    promise,
  )
);
```

For our example the app will have the following structure.

```javascript
app.fruits.list.fetch();
app.fruits.list.isPending(state);
app.fruits.list.hasError(state);
app.fruits.list.getErrorText(state);
app.fruits.list.getEntries(state);
app.fruits.list.reset();
// These 3 actions are wrapped
// by the finalize operation
// convenience actions. They
// don't change anything in the
// backend and only update the list
// in our store.
app.fruits.list.create(entry);
app.fruits.list.update(entry);
app.fruits.list.remove(entry);

app.fruits.create.submit(entry);
app.fruits.create.isPending(state);
app.fruits.create.hasError(state);
app.fruits.create.getErrorText(state);
app.fruits.create.isComplete(state);
app.fruits.create.getEntry(state);
app.fruits.create.reset();

app.fruits.update.submit(entry);
app.fruits.update.isPending(state);
app.fruits.update.hasError(state);
app.fruits.update.getErrorText(state);
app.fruits.update.isComplete(state);
app.fruits.update.getEntry(state);
app.fruits.update.reset();

app.fruits.remove.submit(entry);
app.fruits.remove.isPending(state);
app.fruits.remove.hasError(state);
app.fruits.remove.getErrorText(state);
app.fruits.remove.isComplete(state);
app.fruits.remove.getEntry(state);
app.fruits.remove.reset();

app.fruits.finalizeCreate(entry);
app.fruits.finalizeUpdate(entry);
app.fruits.finalizeRemove(entry);
// Duckling maps also provide
// a reset action, however this action
// depends on the `redux-thunk` middleware
app.fruits.reset();

// and the same for `app.vegetables`
```

## Contributing

Run unit tests and build before pushing/opening a pull request.

- `npm test` - lint and test
- `npm start` - watch and build, etc with alarmist
- `npm run build` - run tests then build
- `npm run watch` - watch for changes and run build
- `npm run ci` - run build and submit coverage to coveralls
