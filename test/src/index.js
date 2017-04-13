import {
  createDuckling,
  resolveDuckling,
} from '../../src';
import {
  createStore,
  applyMiddleware,
} from 'redux';
import thunk from 'redux-thunk';

let store;
let reducer;
let app;

function setupStore(duckling) {
  ({reducer, app} = resolveDuckling(duckling));
  store = createStore(reducer, applyMiddleware(thunk));
  sinon.spy(store, 'dispatch');
};

const identityDuckling = createDuckling(() => ({}));

const incrementer = createDuckling(({action, selector}) => {
  const initialState = {
    countUp: 0,
  };
  const getCountUp = selector((state) => state.countUp);
  const increment = action('INCREMENT');
  const handlers = {
    [increment]: (state) => ({
      ...state,
      countUp: state.countUp + 1,
    }),
  };
  return {
    initialState,
    handlers,
    app: {
      getCountUp,
      increment,
    },
  };
});

const decrementer = createDuckling(({action, selector}) => {
  const initialState = {
    countDown: 0,
  };
  const getCountDown = selector((state) => state.countDown);
  const decrement = action('DECREMENT');
  const handlers = {
    [decrement]: (state) => ({
      ...state,
      countDown: state.countDown - 1,
    }),
  };
  return {
    initialState,
    handlers,
    app: {
      getCountDown,
      decrement,
    },
  };
});

const multipleIncrementers = createDuckling({
  incrementer1: incrementer,
  incrementer2: incrementer,
});

const decrementerIncrementer = createDuckling(
  decrementer,
  incrementer,
);

const complex = createDuckling(
  decrementerIncrementer,
  multipleIncrementers,
  ({action, selector, namespace, app}) => {
    const initialState = {
      test: '',
    };
    const getTest = selector((state) => state.test);
    const test = action('TEST');
    const combo = () => (dispatch) => {
      dispatch(app.increment());
      dispatch(app.decrement());
      dispatch(app.incrementer1.increment());
      dispatch(app.incrementer2.increment());
      dispatch(test(namespace.join('.')));
    };
    const handlers = {
      [test]: (state, {payload: test}) => ({
        ...state,
        test,
      }),
    };
    return {
      initialState,
      handlers,
      app: {
        getTest,
        combo,
      },
    };
  }
);

const deepComplex = createDuckling({
  deep: {
    path: complex,
  },
});

let state;

describe('redux-duckling', () => {
  describe('#resolveDuckling', () => {
    it('should throw an error if given an invalid duckling', () => {
      expect(() => {
        resolveDuckling(0);
      }).to.throw('invalid duckling');
    });
  });

  describe('with an identity duckling', () => {
    beforeEach(() => {
      setupStore(identityDuckling);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be an empty object', () => {
        state.should.eql({});
      });

      describe('then dispatching an action', () => {
        beforeEach(() => {
          store.dispatch({type: 'TEST'});
          state = store.getState();
        });

        it('should not change the state', () => {
          state.should.eql({});
        });
      });
    });

    describe('then the app', () => {
      it('should be an empty object', () => {
        app.should.eql({});
      });
    });
  });

  describe('with a basic incrementer duckling', () => {
    beforeEach(() => {
      setupStore(incrementer);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be 0', () => {
        app.getCountUp(state).should.eql(0);
      });

      describe('then increment', () => {
        beforeEach(() => {
          store.dispatch(app.increment());
          state = store.getState();
        });

        describe('then the type of the action', () => {
          it('should be `INCREMENT`', () => {
            store.dispatch.should.have.been.calledWithMatch({
              type: 'INCREMENT',
            });
          });
        });

        describe('then the state', () => {
          it('should be 1', () => {
            app.getCountUp(state).should.eql(1);
          });
        });
      });
    });
  });

  describe('with a combined incrementers duckling', () => {
    beforeEach(() => {
      setupStore(multipleIncrementers);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be {incrementer1: 0, incrementer2: 0}', () => {
        app.incrementer1.getCountUp(state).should.eql(0);
        app.incrementer2.getCountUp(state).should.eql(0);
      });

      describe('then increment incrementer1', () => {
        beforeEach(() => {
          store.dispatch(app.incrementer1.increment());
          state = store.getState();
        });

        describe('then the type of the action', () => {
          it('should be `incrementer1/INCREMENT`', () => {
            store.dispatch.should.have.been.calledWithMatch({
              type: 'incrementer1/INCREMENT',
            });
          });
        });

        describe('then the state', () => {
          it('should be {incrementer1: 1, incrementer2: 0}', () => {
            app.incrementer1.getCountUp(state).should.eql(1);
            app.incrementer2.getCountUp(state).should.eql(0);
          });
        });
      });
    });
  });

  describe('with a composed decrementerIncrementer duckling', () => {
    beforeEach(() => {
      setupStore(decrementerIncrementer);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be {countUp: 0, countDown: 0}', () => {
        app.getCountUp(state).should.eql(0);
        app.getCountDown(state).should.eql(0);
      });

      describe('then increment', () => {
        beforeEach(() => {
          store.dispatch(app.increment());
          state = store.getState();
        });

        describe('then the type of the action', () => {
          it('should be `INCREMENT`', () => {
            store.dispatch.should.have.been.calledWithMatch({
              type: 'INCREMENT',
            });
          });
        });

        describe('then the state', () => {
          it('should be {countUp: 1, countDown: 0}', () => {
            app.getCountUp(state).should.eql(1);
            app.getCountDown(state).should.eql(0);
          });
        });

        describe('then decrement', () => {
          beforeEach(() => {
            store.dispatch(app.decrement());
            state = store.getState();
          });

          describe('then the type of the action', () => {
            it('should be `DECREMENT`', () => {
              store.dispatch.should.have.been.calledWithMatch({
                type: 'DECREMENT',
              });
            });
          });

          describe('then the state', () => {
            it('should be {countUp: 1, countDown: -1}', () => {
              app.getCountUp(state).should.eql(1);
              app.getCountDown(state).should.eql(-1);
            });
          });
        });
      });
    });
  });

  describe('with a nested complex duckling', () => {
    beforeEach(() => {
      setupStore(deepComplex);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be correct', () => {
        app.deep.path.getCountUp(state).should.eql(0);
        app.deep.path.getCountDown(state).should.eql(0);
        app.deep.path.incrementer1.getCountUp(state).should.eql(0);
        app.deep.path.incrementer2.getCountUp(state).should.eql(0);
        app.deep.path.getTest(state).should.eql('');
      });

      describe('then dispatch the combo action', () => {
        beforeEach(() => {
          store.dispatch(app.deep.path.combo());
          state = store.getState();
        });

        describe('then the state', () => {
          it('should be correct', () => {
            app.deep.path.getCountUp(state).should.eql(1);
            app.deep.path.getCountDown(state).should.eql(-1);
            app.deep.path.incrementer1.getCountUp(state).should.eql(1);
            app.deep.path.incrementer2.getCountUp(state).should.eql(1);
            app.deep.path.getTest(state).should.eql('path.deep');
          });
        });
      });
    });
  });
});
