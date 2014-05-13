// ref: http://sequelizejs.com/docs/latest/usage#options
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp').sync;

var dataRoot = path.join(__dirname, '..', 'data');
module.exports = exports = {
  dialect: 'sqlite',
  storage: path.join(dataRoot, 'oldman.sqlite')
};

if (!fs.existsSync(dataRoot)) {
  mkdirp(dataRoot);
}