var path = require('path');
var crypto = require('crypto');
var util = require('util');

var sha1Sum = util.sha1Sum = function(string, encoding) {
  var sha1 = crypto.createHmac('sha1', 'oldman&sea');
  sha1.update(string, encoding || 'utf8');
  return sha1.digest('hex');
};

util.isPresent = function(v) {
  return typeof v !== 'undefined' && v !== null;
};

util.bool2int = function(bool) {
  return bool ? 1 : 0;
};

util.fillOptionalArgs = function(args, expectCount, coercion4last) {
  if (typeof coercion4last !== 'function') {
    coercion4last = function(v) { return typeof v == 'function';}
  }

  if (!expectCount || !args || args.length == 0) {
    return [];
  }

  var argLen = args.length;
  var lastIdx = argLen - 1;

  if (argLen >= expectCount) {
    if (coercion4last(args[expectCount - 1])) {
      return [].slice.call(args, 0, expectCount);
    }
    var ret = [].slice.call(args, 0, expectCount - 1);
    if (coercion4last(args[lastIdx])) {
      ret.push(args[lastIdx]);
    }
    return ret;
  }

  if (coercion4last(args[lastIdx])) {
    return [].slice.call(args, 0, lastIdx).concat(new Array(expectCount - argLen)).concat(args[lastIdx]);
  }
  return args;
};

var hashOf = util.hashOf = function() {
  if (arguments.length == 0) {
    return '';
  }
  if (arguments.length == 1) {
    return sha1Sum(arguments[0]);
  }
  return sha1Sum(arguments[0] + '/' + hashOf.apply(null, [].slice.call(arguments, 1)))
};

var printableChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
var randomString = util.randomString = function(len) {
  len = parseInt(len);
  if (isNaN(len) || len <= 0) {
    len = Math.floor(Math.random() * 20);
  }

  var result = new Array(len);
  for (var i = 0; i < len; i++) {
    result[i] = printableChars[Math.floor(Math.random() * printableChars.length)];
  }
  return result.join('');
};

module.exports = exports = util;