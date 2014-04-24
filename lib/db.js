var sqlite3 = require('sqlite3');
var async = require('async');
var settings = require('./settings');
var Sqlite3Database = settings.debug ? sqlite3.verbose().cached.Database : sqlite3.cached.Database;

var log = require('./logger');

var db = new Sqlite3Database(settings.dbUri, function(err){
  if (err) {
    log.error('can NOT connect to database [%s]: %j', settings.dbUri, err);
    return;
  }
  log.info('Database [%s] connected!', settings.dbUri);
});

process.on('exit', function(){
  db.close();
});

module.exports = exports = function(ddl) {
  var ret = {};
  ['run', 'get', 'all', 'each', 'exec', 'prepare'].forEach(function(method){
    var v = db[method];
    ret[method] = function() {
      var args = arguments;
      if (ret.__ddlExecuted) {
        return v.apply(db, args);
      } else {
        return v.apply(db.exec(ddl, function(err){
          if (err) {
            log.error('fail to run DDL: %j\n', err);
          } else {
            log.info('DDL executed: \n %s\n', ddl);
            ret.__ddlExecuted = true;
          }
        }), args);
      }
    }
  });

  return ret;
};