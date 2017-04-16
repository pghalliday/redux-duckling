# redux-duckling

[![Build Status](https://travis-ci.org/pghalliday/redux-duckling.svg?branch=master)](https://travis-ci.org/pghalliday/redux-duckling)
[![Build status](https://ci.appveyor.com/api/projects/status/1r6j44rxnf42t36r/branch/master?svg=true)](https://ci.appveyor.com/project/pghalliday/redux-duckling/branch/master)
[![Coverage Status](https://coveralls.io/repos/github/pghalliday/redux-duckling/badge.svg?branch=master)](https://coveralls.io/github/pghalliday/redux-duckling?branch=master)

Composable ducklings

## Motivation

After adopting the [redux duck](https://github.com/erikras/ducks-modular-redux) pattern to create more scalable and self-contained modules for our Redux application, we soon ran into an issue. We had a number of collections that although they were separated in the UI and as a result existed with separate states in the Redux store, they were essentially identical in implementation. All collections could be fetched and listed. All collections could be added to or have entries removed or updated. We had a standard pattern of actions to handle these cases and standard patterns for services that implemented the backend updates. There was a clear need to refactor into generic components that allowed our ducks to be organised hierarchically.

In addition to this, to cleanly manage the state of asynchronous operations like fetching a list of entries or adding a new entry, we broke our ducks into even smaller/more focused chunks. We had a duck to fetch and provide lists and other ducks to manage the state of create, update and remove operations. This introduced a second issue. When an entry has been successfully added, the list also needs to be updated (and the create operation reset). This `FINALIZE_CREATE` action needs to be shared/handled by both the list and create ducks and as such, needs to be defined further up the hierarchy.

This `redux-duckling` library distills all that we learned and refactored to create a standard pattern that kept everything DRY, decoupled and functional.

## Usage

```
npm install --save redux redux-actions redux-duckling
```

```javascript
import {
  createDuckling,
  resolveDuckling,
} from 'redux-duckling';
```

A duckling is a variation on the [redux duck](https://github.com/erikras/ducks-modular-redux) pattern. It encapsulates the same principles but steps away from the ES6 module as the basic unit of reuse. It also adds selectors into the pattern as a best practice to associate selectors with reducers.

A duckling is defined using a function that returns a descriptor containing the `initialState`, the `handlers` for use with [`redux-actions`](https://github.com/acdlite/redux-actions) `handleActions`, and `app` for the actions and selectors.

The function takes 1 argument containing helper functions and properties that facilitate duckling reuse, etc.

Let's look at how we might implement our collection example with asynchronous list, create, update and remove functions.

The flow we are going for will be something like this.

- Initially fetch the list and display it or display an error where the list would have been
- To create an entry, open a dialog
- Submit the entry and somehow indicate pending
  - on error display the error in the create dialog and allow the user to try again
  - on success close the dialog and add the new entry to the list
- To updated an entry, display a dialog
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

const asyncBehavior = createDuckling(({action, selector}) => {
  // Set the initial state
  const initialState = {
    pending: false,
  };

  // Always use the `selector` helper to create basic selectors that act
  // directly on the state. It will be mapped to the correct
  // child state when the duckling is resolved.
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

  // Always use the `action` helper to create basic actions
  // that are handled by the `handlers`.
  // It will enforce namespacing when the duckling is resolved.
  // Internally it maps to `createAction` from `redux-actions`.
  const start = action('START');
  const complete = action('COMPLETE');

  // Create a `handlers` compatible with `handleActions` from `redux-actions`.
  const handlers = {
    [start]: (state) => ({
      ...state,
      pending: true,
      error: undefined,
    }),
    [complete]: (state, {payload: error, error: hasError}) => hasError ? {
      ...state,
      pending: false,
      error,
    } : {
      ...state,
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
});
```

### Composing ducklings

We can use this `asyncBehavior` to create a `list` duckling. The `createDuckling` method can take a variable number of arguments, these can be functions defining ducklings, ducklings already created, or maps of ducklings to child states. The `createDuckling` method populates the `app` helper property to provide access to the already resolved `app`. It also merges the `initialState` and sequences the reducers from left to right.

```javascript
const list = createDuckling(asyncBehavior, ({
  app: {start, complete},
  selector,
  namespace: [_, collection],
}) => {
  // The `app` helper will expose the exports of ducklings
  // that have been so far composed using the `createDuckling`
  // method.
  // We use the `app` to access actions and selectors
  // defined in the shared `asyncBehavior` duckling

  // The `namespace` helper will be an array of string elements
  // describing the location of this instance of the duckling
  // in the state. To prevent coupling a duckling to its
  // absolute position in the state hierarchy, the array is
  // ordered in reverse so that the current leaf name is first,
  // the parent leaf name is second, etc.
  // We use the `namespace` helper to determine which collection
  // we are listing

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
      ...state,
      entries: [],
    }),
    [complete]: (state, {payload: entries, error}) => error ? state : {
      ...state,
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
});
```

Noting that `create`, `update` and `remove` operations all follow the same pattern, we can use the `createDuckling` method to then create a generic `operation` duckling that also extends the `asyncBehavior`.

```javascript
const operation = createDuckling(asyncBehavior, ({
  app: {start, complete},
  selector,
  namespace: [operation, collection],
}) => {
  const initialState = {
    complete: false,
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
      ...state,
      entry,
    }),
    [complete]: (state, {error}) => error ? state : {
      ...state,
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
});
```

### Combining ducklings

Ducklings can be combined much like reducers, by assigning them to child paths of a parent state. The `createDuckling` method is used to do this.

In fact this does eventually combine the reducers with `redux.combineReducers` when they are resolved. However, it also wraps the selectors so that they operate on the child state and sets the action types to namespace them according to the ducks standard.

For our example we have our `operation` functionality and can start combining it into a generic `collection` duckling. This will contain the operations and export the initial `fetch` and the finalize operation actions.

**NB. it is not possible to merge other `handlers` or `initialState` with a combined duckling. If you attempt to do so an error will be thrown. This is because in most cases the states will conflict and although it would be possible to manage this, doing so quickly gets mind bendingly complicated. This is the reason that the `list` duckling is defined separately (you may think that it would naturally sit at the collection level)**

```javascript
const collection = createDuckling({
  list,
  create: operation,
  update: operation,
  remove: operation,
}, ({
  app,
}) => {
  // this utility function and the use of reduce
  // below may be overkill but it is in keeping
  // with our desire to keep everything DRY
  const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

  // Here we can use the `app` parameter to access
  // the actions (and selectors) of our child ducklings.
  // We are also taking advantage of the `redux-thunk`
  // middleware to turn a single action into two (even
  // though they are not asynchronous).
  // Notice that here we are using a `reset` action that
  // we didn't define. As a convenience, ducklings will
  // define a `reset` action and handle it
  // by returning the initial state.
  const exports = [
    'create',
    'update',
    'remove',
  ].reduce((operation, exports) => {
    exports[`finalize${capitalize(operation)}`] = (entry) => (dispatch) => {
      dispatch(app[operation].reset());
      dispatch(app.list[operation](entry));
    };
    return exports;
  }, {});

  return {
    app: exports,
  };
});
```

And we're there! Now a number of collections can be defined in the state that share this set of behaviors

```javascript
const duckling = createDuckling({
  fruits: collection,
  vegetables: collection,
});
```

### Resolving the reducer and app

After combining and composing ducklings the reducer and app still need to be resolved before they can be used.

```javascript
const {reducer, app} = resolveDuckling(duckling);
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

// and the same for `app.vegetables`
```

## Contributing

Run unit tests and build before pushing/opening a pull request.

- `npm test` - lint and test
- `npm start` - watch and build, etc with alarmist
- `npm run build` - run tests then build
- `npm run watch` - watch for changes and run build
- `npm run ci` - run build and submit coverage to coveralls
