var async = require('async');
var QueryChainer = require('sequelize').Utils.QueryChainer;
var _ = require('lodash');
var moment = require('moment');

var log = require('../lib/logger');
var util = require('../lib/util');
var db = require('../lib/db');
var conf = require('../conf');

var listAll = exports.all = function(admin, active, callback) {
  var args = util.fillOptionalArgs(arguments, 3);
  admin = args[0];
  active = args[1];
  callback = args[2] || function(){};

  var qOpt = { where: {}, order: 'username' };
  if (util.isPresent(admin)) {
    qOpt.where.admin = admin;
  }
  if (util.isPresent(active)) {
    qOpt.where.active = active;
  }

  db.model('User').findAll(qOpt).complete(function(err, users) {
    if (err) {
      log.warn('fail to fetch users: %j', err);
      callback(new Error('fail to fetch users'));
    } else {
      log.info('%d users fetched!', users ? users.length : 0);
      callback(null, users);
    }
  });
};

var listAdmins = exports.admins = listAll.bind(null, true);

var listActives = exports.actives = listAll.bind(null, null, true);

var create = exports.create = function(user, callback) {
  if (!user.username || !user.password) {
    callback(new Error("username & password must be provided"));
    return;
  }

  async.series([
    function(cb){
      getByName(user.username, function(err, user){
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
      db.model('User').build(_.defaults({password: util.sha1Sum(user.password)}, user))
        .save()
        .complete(function(err){
          if (err) {
            log.warn('fail to create user: %j', err);
            cb(new Error('fail to create user'));
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
  db.model('User').find({where: {username: username}}).complete(function(err, user){
    if (err) {
      log.warn('fail to get user record: %j', err);
      callback(new Error('database not connected or table [user] not exists'));
    } else {
      callback(null, user);
    }
  });
};

exports.update = function(user, callback){
  var updated = user.password ? _.defaults({password: util.sha1Sum(user.password)}, user) : user;
  var where = user.id ? {id: user.id} : {username: user.username};
  db.model('User')
    .update(updated, where)
    .complete(function(err){
    if (err) {
      log.warn('fail to update user[%s]: %j', user.username, err);
      callback(new Error('fail to update user'));
    } else {
      log.info('user [%s] updated', user.username);
      callback();
    }
  });
};

var removeByName = exports.removeByName = function(username, callback) {
  db.model('User').destroy({username: username}).complete(function(err){
    if (err) {
      log.warn('fail to remove %s: %j', username, err);
      callback(new Error('fail to remove ' + username));
    } else {
      log.info('user [%s] removed!', username);
      callback();
    }
  });
};

exports.clear = function(callback) {
  var qChain = new QueryChainer;

  ['Auth', 'User'].forEach(function(modelName){
    qChain.add(db.model(modelName).destroy());
  });

  qChain.run().complete(function(err){
    if (err) {
      log.warn('fail to clear users & logins: %j', err);
      callback(new Error('fail to clear users & logins'));
    } else {
      log.info('ALL users & logins cleared!');
      callback();
    }
  });
};

function saveAuth(auth, callback) {
  auth.setDataValue('tokenExpire', util.noMilliseconds(auth.tokenExpire));
  auth.save().complete(function(err){
    if (err) {
      log.warn('fail to update auth record of %s: %j', auth.getUser().username, err);
      callback(new Error('fail to update login record'));
    } else {
      log.info('auth [Id:%d] saved!', auth.UserId);
      callback(null, auth);
    }
  });
}

exports.login = function(username, password, admin, callback) {
  if (typeof admin == 'function') {
    callback = admin;
    admin = null;
  }

  if (typeof admin == 'function') {
    callback = admin;
    admin = null;
  }

  async.waterfall([
    getByName.bind(null, username),
    function(user, cb) {
      if (user == null || !user.active || (admin && !user.admin) || user.password !== util.sha1Sum(password)) {
        log.warn('fail to auth %s/%s', username, password);
        cb(new Error('fail to auth'));
      } else {
        log.info('user [%s] authorized!', username);
        var now = Date.now();
        user.createAuth({
          token: util.sha1Sum([user.username, now].join('-')),
          tokenExpire: moment().add(conf.authDuration[0], conf.authDuration[1]).toDate()
        }).complete(function(err, auth){
          if (err) {
            log.warn('fail to create auth [user: %s]: %j', username, err);
            cb(new Error('fail to create auth'));
          } else {
            cb(null, auth);
          }
        });
      }
    },
    saveAuth
  ], callback);
};

exports.oAuth = function(authId, callback) {
  callback();
};

exports.tokenAuth = function(token, callback) {
  //db.model('Auth').find({where})
};

exports.latestAuth = function(username, valid, callback) {
  if (typeof valid == 'function') {
    callback = valid;
    valid = null;
  }

  async.waterfall([
    getByName.bind(null, username),
    function(user, cb){
      if (!user) {
        log.warn('fetch auths, but user [%s] not present', username);
        cb(new Error('fail to fetch auths'));
      } else {
        user.getAuths({order: 'tokenExpire DESC', limit: 1}).complete(function(err, auths){
          if (err) {
            log.warn('fail to fetch auths of user [%s]: %j', username, err);
            return cb(new Error('fail to fetch auths'));
          }

          var auth = auths && auths[0];
          if (!auth) {
            log.warn('%s not authorized ever!', username);
            return cb();
          }
          if (!valid) {
            return cb(null, auth);
          }

          var expire = auth.tokenExpire && moment(auth.tokenExpire);
          if (expire && expire.isValid() && expire.isAfter(moment())) {
            cb(null, auth);
          } else {
            log.warn('authorization for %s was expired!', username);
            cb();
          }
        });
      }
    }
  ], callback);
};

exports.auths = function(username, callback) {
  async.waterfall([
    getByName.bind(null, username),
    function(user, cb){
      if (!user) {
        log.warn('fetch auths, but user [%s] not present', username);
        cb(new Error('fail to fetch auths'));
      } else {
        user.getAuths({order: ['tokenExpire', 'DESC']}).complete(function(err, auths){
          if (err) {
            log.warn('fail to fetch auths of user [%s]: %j', username, err);
            cb(new Error('fail to fetch auths'));
          } else {
            log.info('%d auths of user [%s] fetched!', auths ? auths.length : 0);
            cb(null, auths);
          }
        });
      }
    }
  ], callback);
};
