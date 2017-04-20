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
  // The `reduce` helper function can be used to apply
  // actions to child ducklings without dispatching them.
  // It takes the state and an array of actions to apply
  // and returns a new state
  reduce,
  // The `app` object provides access to actions and selectors
  // defined in the ducklings that this duckling extends.
  // At the very least this will contain a `reset` action
  // as all ducklings will resolve with a `reset` action
  // that restores the initial state.
  app,
}) {
  const myAction = action('MY_ACTION');
  const mySelector = selector((state) => state.myField);
  return {
    initialState: {
      myField: undefined,
    }
    // Internally, the `handlers` object  and merged `initialState`
    // will be used to generate a reducer using the `handleActions`
    // function from `redux-actions`
    // Note that as we don't know what other handlers in the chain
    // might be doing, the return from these handlers will always 
    // be merged with the current state. This means that if you want
    // to remove any field from the state it is not enough to simply
    // omit it. It must be explicitly set to undefined.
    handlers: {
      [myAction]: (state, action) => ({
        myField: action.payload,
      }),
    },
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
// and chaining their reducers.
// When merging an array of ducklings, first the array
// will be flattened and then all the duckling maps will
// be extracted in order and merged first from left to
// right. Only then will the remaining duckling functions
// be merged, also from left to right.
//
// NB. duckling maps always get merged first!
const duckling = [
  duckling1,
  duckling2,
  duckling3,
];
```

Combine ducklings...

```javascript
// The following duckling map will be combined
// so that the resulting duckling will have
// correspondingly named child ducklings.
// The resulting actions and selectors will
// be correctly namespaced according to the
// hierarchy.
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
//
// ./lib/async-behavior.js
//

// we will use reselect to compose selectors
import {
  createSelector,
} from 'reselect';

export default function({action, selector}) {
  const isPending = selector((state) => state.pending);
  const error = selector((state) => state.error);

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

  return {
    initialState: {
      pending: false,
      error: undefined,
    },
    handlers: {
      [start]: () => ({
        pending: true,
        error: undefined,
      }),
      // We use the `next/throw` feature from
      // `redux-actions` to distinguish success
      // and error cases
      [complete]: {
        next: () => ({
          pending: false,
        }),
        throw: (_ {payload: error}) => ({
          pending: false,
          error,
        }),
      },
    },
    app: {
      isPending,
      hasError,
      getErrorText,
      start,
      complete,
    },
  };
}
```

### Composing ducklings

Noting that `create`, `update` and `remove` operations all follow the same pattern, we can compose a generic `operation` duckling that extends the `asyncBehavior`. Ducklings can be composed by listing them in an array, the `resolve` method then populates the `app` helper property to provide access to the already resolved `app`. It also merges the `initialState` and sequences the reducers from left to right.

```javascript
//
// ./lib/collection/operation.js
//

import asyncBehavior from '../async-behavior';

// Here we will use a factory method to
// generate new duckling definitions. The `service`
// that is passed in will determine which collection
// and which operation is being performed
export default function(service) {
  return [asyncBehavior, ({
    selector,
    app: {start, complete},
  }) => {
    return {
      initialState: {
        complete: false,
        entry: undefined,
      },
      handlers: {
        [start]: (_, {payload: entry}) => ({
          complete: false,
          entry,
        }),
        [complete]: {
          next: () => ({
            complete: true,
          }),
        },
      },
      app: {
        getEntry: selector((state) => state.entry),
        isComplete: selector((state) => state.complete),
        // Use the `redux-thunk` middleware for the
        // asynchronous `submit` action
        submit: (entry) => (dispatch) => {
          dispatch(start(entry));
          // We expect the passed in `service` to implement
          // a `submit` method that returns a promise. This
          // promise can then be handled by the `redux-promise`
          // middleware
          return dispatch(complete(service.submit(entry)));
        },
      },
    };
  }];
}
```

### Combining ducklings

Ducklings can be combined much like reducers, by assigning them to child paths of a parent state using an object mapping. However, it also wraps the selectors so that they operate on the child state and sets the action types to namespace them according to the ducks standard.

For our example we have our `operation` functionality and can start combining it into a generic `collection` duckling. This will also implement the list functionality.

```javascript
//
// ./lib/collection/index.js
//

import asyncBehavior from '../async-behaviour';
import operationFactory from './operation';

// This time the service passed in to the factory
// should contain the other services we need and
// again should be specific to the collection
export default function(service) {
  return [asyncBehavior, {
    create: operationFactory(service.create),
    update: operationFactory(service.update),
    remove: operationFactory(service.remove),
  }, ({
    action,
    selector,
    // We will use the `reduce` helper
    // to update our child states but only
    // notify a single change
    reduce,
    app: {start, complete},
  }) => {
    const finalizeCreate = action('FINALIZE_CREATE');
    const finalizeUpdate = action('FINALIZE_UPDATE');
    const finalizeRemove = action('FINALIZE_REMOVE');
    return {
      initialState: {
        entries: [],
      },
      handlers: {
        [start]: () => ({
          entries: [],
        }),
        [complete]: {
          next: (_ {payload: entries}) => ({
            entries,
          }),
        },
        [finalizeCreate]: (state, {payload: entry}) => ({
          ...reduce(state, [['create', 'reset']]),
          entries: [
            ...state.entries,
            entry,
          ],
        }),
        [finalizeUpdate]: (state, {payload: entry}) => ({
          ...reduce(state, [['update', 'reset']]),
          entries: state.entries.map(
            (original) => entry.key === original.key ? entry : original,
          ),
        }),
        [finalizeRemove]: (state, {payload: entry}) => ({
          ...reduce(state, [['remove', 'reset']]),
          entries: state.entries.filter((entry) => entry.key !== key),
        }),
      },
      app: {
        getEntries: selector((state) => state.entries),
        fetch: () => (dispatch) => {
          dispatch(start());
          return dispatch(complete(service.fetch()));
        },
        finalizeCreate,
        finalizeUpdate,
        finalizeRemove,
      },
    };
  }];
}
```

### Resolving the reducer and app

And we're there! Now a number of collections can be defined in the state that share this set of behaviors. After combining and composing ducklings the `reducer` and `app` still need to be resolved before they can be used.

```javascript
//
// ./index.js
//

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

// Our top level service to abstract the back end
// asynchronous operations using promises
import service from './service';

import collectionFactory from './lib/collection';

// Define 2 collections
const duckling = {
  fruits: collectionFactory(service.fruits),
  vegetables: collectionFactory(service.vegetables),
};

const {reducer, app} = resolve(duckling);
export {app};

export const store = createStore(
  reducer,
  applyMiddleware(
    thunk,
    promise,
  )
);
```

For our example the app will have the following structure to support our UI flow.

```javascript
app.fruits.fetch();
app.fruits.isPending(state);
app.fruits.hasError(state);
app.fruits.getErrorText(state);
app.fruits.getEntries(state);
app.fruits.finalizeCreate(entry);
app.fruits.finalizeUpdate(entry);
app.fruits.finalizeRemove(entry);
app.fruits.reset();

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

// and the same for `app.vegetables`
```

## Contributing

Run unit tests and build before pushing/opening a pull request.

- `npm test` - lint and test
- `npm start` - watch and build, etc with alarmist
- `npm run build` - run tests then build
- `npm run watch` - watch for changes and run build
- `npm run ci` - run build and submit coverage to coveralls
