var path = require('path');
var fs = require('fs');
var util = require('../lib/util');

var env = process.env;

// ref: http://momentjs.com/docs/#/manipulating/add
// in format of "numberShorthand", such as: 1y, 2M, 3d, 1w, 5h, 30m, 120s
// unit of ms, not supported.
var authDuration = (function(){
  var match = /^(\d+)(y|M|w|d|h|m|s)$/.exec(env.OM_AUTH_DURATION || '1w');
  return [match[2], match[1]] || [1, 'w'];
})();

var conf = module.exports = exports = {
  appPort:        env.OM_PORT || 12000,
  upstream:       env.OM_UPSTREAM || 'http://spmjs.org',
  authDuration:   authDuration,
  inventoryRoot:  env.OM_INV_ROOT || path.join(__dirname, '..', 'inventory'),

  dbOption:       require(env.OM_DB_OPTION || './db-sqlite'),

  log: {
    level: env.OM_LOG_LEVEL || 'info',
    file:  env.OM_LOG_FILE || path.join(util.osTempDir, 'oldman.log')
  }
};

util.mkdirSync(conf.inventoryRoot);
util.mkdirSyncForFile(conf.log.file);
