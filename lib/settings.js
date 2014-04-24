var path = require('path');
var fs = require('fs');
var mkdirp = require('mkdirp').sync;

var osTemp = process.env.TMPDIR || process.env.TMP || process.env.TEMP ||
  ( process.platform === 'win32' ? 'c:\\windows\\temp' : '/tmp');
var debug = !!(process.env.OM_DEBUG);
var dbRoot = process.env.OM_DB_ROOT || path.join(__dirname, '../data');
if (!fs.existsSync(dbRoot)) mkdirp(dbRoot);

module.exports = exports = {
  debug: debug,
  appPort: process.env.PORT || 12000,

  dbUri: path.join(dbRoot, 'oldman.db'),

  logLevel: process.env.OM_LOG_LEVEL || (debug ? 'info' : 'debug'),
  logFile:  process.env.OM_LOG_FILE || path.join(osTemp, 'oldman.log')
};
