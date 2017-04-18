import resolve from '../../src';
import {
  createStore,
  applyMiddleware,
} from 'redux';
import thunk from 'redux-thunk';

let store;
let reducer;
let app;

function setupStore(duckling) {
  ({reducer, app} = resolve(duckling));
  store = createStore(reducer, applyMiddleware(thunk));
  sinon.spy(store, 'dispatch');
};

const identityDuckling = () => ({});

const incrementer = ({action, selector}) => {
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
};

const decrementer = ({action, selector}) => {
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
};

const toggle = ({action, selector}) => {
  const initialState = {
    toggle: false,
  };
  const getToggle = selector((state) => state.toggle);
  const toggle = action('TOGGLE');
  const handlers = {
    [toggle]: (state) => ({
      ...state,
      toggle: !state.toggle,
    }),
  };
  return {
    initialState,
    handlers,
    app: {
      getToggle,
      toggle,
    },
  };
};

const multipleIncrementers = {
  incrementer1: incrementer,
  incrementer2: incrementer,
};

const decrementerIncrementer = [
  decrementer,
  incrementer,
];

const decrementerIncrementerToggle = [
  decrementerIncrementer,
  toggle,
];

const namespaced = {
  deep: {
    path: ({action, selector, namespace}) => {
      const initialState = {
        test: '',
      };
      const getTest = selector((state) => state.test);
      const test = action('TEST');
      const setTest = () => (dispatch) => {
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
          setTest,
        },
      };
    },
  },
};

const mergedCombined = [
  multipleIncrementers, {
    incrementer3: incrementer,
    incrementer4: incrementer,
  },
];

const container = [
  multipleIncrementers,
  ({app: {incrementer1, incrementer2}}) => {
    const incrementAll = () => (dispatch) => {
      dispatch(incrementer1.increment());
      dispatch(incrementer2.increment());
    };
    return {
      app: {
        incrementAll,
      },
    };
  },
];

const initialState = () => ({
  initialState: {
    value: true,
  },
});

const handlers = () => ({
  handlers: {
    'ACTION': (state) => state,
  },
});

const errorMergeInitialStateWithCombined = [
  initialState,
  multipleIncrementers,
];

const errorMergeCombinedWithInitialState = [
  multipleIncrementers,
  initialState,
];

const errorMergeHandlersWithCombined = [
  handlers,
  multipleIncrementers,
];

const errorMergeCombinedWithHandlers = [
  multipleIncrementers,
  handlers,
];

let state;

describe('redux-duckling', () => {
  describe('#resolve', () => {
    it('should error if given an invalid duckling', () => {
      expect(() => {
        resolve(0);
      }).to.throw('invalid duckling');
    });

    it('should error merging initialState with combined duckling', () => {
      expect(() => {
        resolve(errorMergeInitialStateWithCombined);
      }).to.throw(
        'Cannot merge a non empty `initialState` with duckling map'
      );
    });

    it('should error merging combined duckling with initial state', () => {
      expect(() => {
        resolve(errorMergeCombinedWithInitialState);
      }).to.throw(
        'Cannot merge a non empty `initialState` with duckling map'
      );
    });

    it('should error merging handlers with combined duckling', () => {
      expect(() => {
        resolve(errorMergeHandlersWithCombined);
      }).to.throw(
        'Cannot merge non empty `handlers` with duckling map'
      );
    });

    it('should error merging combined duckling with handlers', () => {
      expect(() => {
        resolve(errorMergeCombinedWithHandlers);
      }).to.throw(
        'Cannot merge non empty `handlers` with duckling map'
      );
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
      it('should just have a reset action', () => {
        app.reset.should.be.ok;
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

        describe('then reset', () => {
          beforeEach(() => {
            store.dispatch(app.reset());
            state = store.getState();
          });

          describe('then the type of the action', () => {
            it('should be `RESET`', () => {
              store.dispatch.should.have.been.calledWithMatch({
                type: 'RESET',
              });
            });
          });

          describe('then the state', () => {
            it('should be 0', () => {
              app.getCountUp(state).should.eql(0);
            });
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

        describe('then reset incrementer1', () => {
          beforeEach(() => {
            store.dispatch(app.incrementer1.reset());
            state = store.getState();
          });

          describe('then the type of the action', () => {
            it('should be `incrementer1/RESET`', () => {
              store.dispatch.should.have.been.calledWithMatch({
                type: 'incrementer1/RESET',
              });
            });
          });

          describe('then the state', () => {
            it('should be {incrementer1: 0, incrementer2: 0}', () => {
              app.incrementer1.getCountUp(state).should.eql(0);
              app.incrementer2.getCountUp(state).should.eql(0);
            });
          });
        });
      });
    });
  });

  describe('with a merged combined incrementers duckling', () => {
    beforeEach(() => {
      setupStore(mergedCombined);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be correct', () => {
        app.incrementer1.getCountUp(state).should.eql(0);
        app.incrementer2.getCountUp(state).should.eql(0);
        app.incrementer3.getCountUp(state).should.eql(0);
        app.incrementer4.getCountUp(state).should.eql(0);
      });

      describe('then increment incrementer1 and incrementer3', () => {
        beforeEach(() => {
          store.dispatch(app.incrementer1.increment());
          store.dispatch(app.incrementer3.increment());
          state = store.getState();
        });

        describe('then the type of the action', () => {
          it('should be `incrementer1/INCREMENT`', () => {
            store.dispatch.should.have.been.calledWithMatch({
              type: 'incrementer1/INCREMENT',
            });
          });
          it('should be `incrementer3/INCREMENT`', () => {
            store.dispatch.should.have.been.calledWithMatch({
              type: 'incrementer3/INCREMENT',
            });
          });
        });

        describe('then the state', () => {
          it('should be correct', () => {
            app.incrementer1.getCountUp(state).should.eql(1);
            app.incrementer2.getCountUp(state).should.eql(0);
            app.incrementer3.getCountUp(state).should.eql(1);
            app.incrementer4.getCountUp(state).should.eql(0);
          });
        });

        describe('then reset', () => {
          beforeEach(() => {
            store.dispatch(app.reset());
            state = store.getState();
          });

          describe('then the state', () => {
            it('should be correct', () => {
              app.incrementer1.getCountUp(state).should.eql(0);
              app.incrementer2.getCountUp(state).should.eql(0);
              app.incrementer3.getCountUp(state).should.eql(0);
              app.incrementer4.getCountUp(state).should.eql(0);
            });
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

          describe('then reset', () => {
            beforeEach(() => {
              store.dispatch(app.reset());
              state = store.getState();
            });

            describe('then the type of the action', () => {
              it('should be `RESET`', () => {
                store.dispatch.should.have.been.calledWithMatch({
                  type: 'RESET',
                });
              });
            });

            describe('then the state', () => {
              it('should be {countUp: 0, countDown: 0}', () => {
                app.getCountUp(state).should.eql(0);
                app.getCountDown(state).should.eql(0);
              });
            });
          });
        });
      });
    });
  });


  describe('with a deeply composed duckling', () => {
    beforeEach(() => {
      setupStore(decrementerIncrementerToggle);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be {countUp: 0, countDown: 0, toggle: false}', () => {
        app.getCountUp(state).should.eql(0);
        app.getCountDown(state).should.eql(0);
        app.getToggle(state).should.be.false;
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
          it('should be {countUp: 1, countDown: 0, toggle: false}', () => {
            app.getCountUp(state).should.eql(1);
            app.getCountDown(state).should.eql(0);
            app.getToggle(state).should.be.false;
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
            it('should be {countUp: 1, countDown: -1, toggle: false}', () => {
              app.getCountUp(state).should.eql(1);
              app.getCountDown(state).should.eql(-1);
              app.getToggle(state).should.be.false;
            });
          });

          describe('then toggle', () => {
            beforeEach(() => {
              store.dispatch(app.toggle());
              state = store.getState();
            });

            describe('then the type of the action', () => {
              it('should be `TOGGLE`', () => {
                store.dispatch.should.have.been.calledWithMatch({
                  type: 'TOGGLE',
                });
              });
            });

            describe('then the state', () => {
              it('should be {countUp: 1, countDown: -1: toggle: true}', () => {
                app.getCountUp(state).should.eql(1);
                app.getCountDown(state).should.eql(-1);
                app.getToggle(state).should.be.true;
              });
            });

            describe('then reset', () => {
              beforeEach(() => {
                store.dispatch(app.reset());
                state = store.getState();
              });

              describe('then the type of the action', () => {
                it('should be `RESET`', () => {
                  store.dispatch.should.have.been.calledWithMatch({
                    type: 'RESET',
                  });
                });
              });

              describe('then the state', () => {
                it('should be the initial state', () => {
                  app.getCountUp(state).should.eql(0);
                  app.getCountDown(state).should.eql(0);
                  app.getToggle(state).should.be.false;
                });
              });
            });
          });
        });
      });
    });
  });

  describe('with a container duckling', () => {
    beforeEach(() => {
      setupStore(container);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be {incrementer1: 0, incrementer2: 0}', () => {
        app.incrementer1.getCountUp(state).should.eql(0);
        app.incrementer2.getCountUp(state).should.eql(0);
      });

      describe('then incrementAll', () => {
        beforeEach(() => {
          store.dispatch(app.incrementAll());
          state = store.getState();
        });

        describe('then the state', () => {
          it('should be {incrementer1: 1, incrementer2: 1}', () => {
            app.incrementer1.getCountUp(state).should.eql(1);
            app.incrementer2.getCountUp(state).should.eql(1);
          });
        });

        describe('then reset', () => {
          beforeEach(() => {
            store.dispatch(app.reset());
            state = store.getState();
          });

          describe('then the state', () => {
            it('should be {incrementer1: 0, incrementer2: 0}', () => {
              app.incrementer1.getCountUp(state).should.eql(0);
              app.incrementer2.getCountUp(state).should.eql(0);
            });
          });
        });
      });
    });
  });

  describe('with a namespaced duckling', () => {
    beforeEach(() => {
      setupStore(namespaced);
    });

    describe('then the initial state', () => {
      beforeEach(() => {
        state = store.getState();
      });

      it('should be \'\'', () => {
        app.deep.path.getTest(state).should.eql('');
      });

      describe('then dispatch the setTest action', () => {
        beforeEach(() => {
          store.dispatch(app.deep.path.setTest());
          state = store.getState();
        });

        describe('then the state', () => {
          it('should be \'path.deep\'', () => {
            app.deep.path.getTest(state).should.eql('path.deep');
          });
        });
      });
    });
  });
});
