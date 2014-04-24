var async = require('async');
var multiline = require('multiline');

var log = require('../lib/logger');
var util = require('../lib/util');

var ddl = multiline(function(){/*
  CREATE TABLE IF NOT EXISTS user (
    username varchar(50) NOT NULL PRIMARY KEY,
    password text        NOT NULL,
    admin    boolean     DEFAULT 0,
    active   boolean     DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS login (
    username varchar(50) NOT NULL,
    last     datetime,
    times    int         DEFAULT 1,
    CONSTRAINT fk_login_user FOREIGN KEY (username) REFERENCES user(username)
  );
*/});

var db = require('../lib/db')(ddl);

var listAll = exports.all = function(admin, active, callback) {
  var args = util.fillOptionalArgs(arguments, 3);
  admin = args[0];
  active = args[1];
  callback = args[2] || function(){};

  var sql = 'SELECT * FROM user WHERE 1=1';
  if (util.isPresent(admin)) {
    sql += ' AND admin=' + util.bool2int(admin);
  }
  if (util.isPresent(active)) {
    sql += ' AND active=' + util.bool2int(active);
  }
  sql += ' ORDER BY username';

  db.all(sql, function(err, rows){
    if (err) {
      log.warn('fail to fetch users: %j', err);
      callback('fail to fetch users');
    } else {
      log.info('%d users fetched!', rows ? rows.length : 0);
      callback(null, rows);
    }
  });
};

var listAdmins = exports.admins = function(active, callback) {
  listAll(true, active, callback);
};

var listActives = exports.actives = function(callback) {
  listAll(null, true, callback);
};

var create = exports.create = function(user, callback) {
  if (!user.username || !user.password) {
    callback("username & password must be provided");
    return;
  }

  async.series([
    function(cb){
      exports.getByName(user.username, function(err, user){
        if (err) {
          cb(err);
        } else if (user) {
          var msg = util.format('user[%s] already exists!', user.username);
          log.warn(msg);
          cb(msg);
        } else {
          cb();
        }
      });
    },
    function(cb){
      db.run('INSERT INTO user (username, password, admin, active) VALUES (?,?,?,?)',
        user.username, util.sha1Sum(user.password),
        util.bool2int(user.admin), util.bool2int(user.active !== false),
        function(err){
          if (err) {
            log.warn('fail to create user: %j', err);
            cb('fail to create user');
          } else {
            log.info('user [%s] created!', user.username);
            cb();
          }
        }
      );
    }
  ], callback);
};

var getByName = exports.getByName = function(username, callback) {
  db.get('SELECT * FROM user WHERE username=?', username, function(err, row){
    if (err) {
      log.warn('fail to get user record: %j', err);
      callback('database not connected or table [user] not exists');
    } else if (row){
      callback(null, row);
    } else {
      callback();
    }
  });
};

exports.update = function(user, callback){
  var sql = 'UPDATE user SET username=username';
  if (util.isPresent(user.password)) {
    sql += ",password='" + util.sha1Sum(user.password) + "'";
  }
  if (util.isPresent(user.admin)) {
    sql += ',admin=' + util.bool2int(user.admin);
  }
  if (util.isPresent(user.active)) {
    sql += ',active=' + util.bool2int(user.active);
  }
  sql += " WHERE username='" + user.username + "'";

  db.exec(sql, function(err){
    if (err) {
      log.warn('fail to update user[%s]: %j', user.username, err);
      callback('fail to update user');
    } else {
      log.info('user [%s] updated', user.username);
      callback();
    }
  });
};

var removeByName = exports.removeByName = function(username, callback) {
  db.run('DELETE FROM user WHERE username=?', username, function(err){
    if (err) {
      log.warn('fail to remove %s: %j', username, err);
      callback('fail to remove ' + username);
    } else {
      log.info('user [%s] removed!', username);
      callback();
    }
  });
};

var sqlClear = multiline(function(){/*
  BEGIN;
    DELETE FROM login;
    DELETE FROM user;
  COMMIT;
*/});
exports.clear = function(callback) {
  db.exec(sqlClear, function(err){
    if (err) {
      log.warn('fail to clear records of table[user & login]: %j', err);
      callback('failed');
    } else {
      log.info('ALL users & logins cleared!');
      callback();
    }
  });
};

var auth = exports.auth = function(username, password, callback) {
  async.waterfall([
    function(cb){
      getByName(username, cb);
    },
    function(user, cb) {
      if (user != null && user.active && user.password == util.sha1Sum(password)) {
        log.info('user [%s] authorized!', username);
        cb(null, user);
      } else {
        log.warn('fail to auth %s/%s', username, password);
        cb('fail to auth');
      }
    }
  ], callback);
};

var authAsAdmin = exports.authAsAdmin = function(username, password, callback) {
  async.waterfall([
    function(cb) {
      auth(username, password, cb);
    },
    function(user, cb) {
      if (user.admin) {
        log.info('user [%s] authorized as admin!', username);
        cb(null, user);
      } else {
        log.warn('%s is not admin', username);
        cb('fail to auth as admin');
      }
    }
  ], callback);
};

function addLoginLog(user, callback) {
  db.run("UPDATE login SET times=times+1, last=datetime('now','localtime') WHERE username=?", user.username, function(err){
    if (err) {
      log.warn('fail to update login record of %s: %j', user.username, err);
      callback('fail to update login record');
    } else {
      if (this.changes) {
        callback();
      } else {
        db.run("INSERT INTO login (username, last) VALUES (?, datetime('now','localtime'))", user.username, function(err) {
          if (err) {
            log.warn('fail to insert login record of %s: %j', user.username, err);
            callback('fail to insert login record');
          } else {
            log.info('login [%s] recorded!', user.username);
            callback();
          }
        });
      }
    }
  });
}

exports.login = function(username, password, callback) {
  async.waterfall([
    function(cb) {
      auth(username, password, cb);
    },
    addLoginLog
  ], callback);
};

exports.loginAsAdmin = function(username, password, callback) {
  async.waterfall([
    function(cb) {
      authAsAdmin(username, password, cb);
    },
    addLoginLog
  ], callback);
};

exports.loginInfo = function(username, callback) {
  db.get('SELECT * FROM login WHERE username=?', username, function(err, row){
    if (err) {
      log.warn('fail to fetch login record of %s: %j', username, err);
      callback('fail to fetch login record');
    } else {
      callback(null, row);
    }
  });
};