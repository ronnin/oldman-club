var db = require('../lib/db');
var dbOptions = require('../conf/db-sqlite-test');
//var dbOptions = require('../conf/db-mysql');
//var dbOptions = require('../conf/db-mariadb');

exports.init = db.init.bind(null, dbOptions, true);
