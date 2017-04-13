'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = combine;

var _lodash = require('lodash');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function remap(selectors, key) {
  return _lodash2.default.mapValues(selectors, function (selector) {
    if (typeof selector === 'function') {
      return function (state) {
        return selector(state[key]);
      };
    }
    return remap(selector, key);
  });
}

function combine(selectors) {
  return _lodash2.default.mapValues(selectors, function (selector, key) {
    if (typeof selector === 'function') {
      return selector;
    }
    return remap(selector, key);
  });
};