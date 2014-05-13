var async = require('async');
var QueryChainer = require('sequelize').Utils.QueryChainer;
var _ = require('lodash');
var S = require('string');

var log = require('../lib/logger');
var util = require('../lib/util');

var db = require('../lib/db');

exports.modules = function(queryOptions, callback) {
  if (typeof queryOptions == 'function') {
    callback = queryOptions;
    queryOptions = {};
  }
  var familyLike = queryOptions.family;
  var nameLike = queryOptions.name;
  var orderBy = queryOptions.orderBy;
  callback = callback || function(){};

  var where = [];
  if (familyLike && familyLike !== '%') {
    where.push(['family LIKE ?', familyLike]);
  }
  if (nameLike && nameLike !== '%') {
    where.push(['name LIKE ?', nameLike]);
  }

  db.model('Module')
    .findAll({where: where, order: orderBy, include: [{ model: db.model('Version'), as: 'latestVersion' }]})
    .complete(function(err, rows){
      if (err) {
        log.warn('fail to fetch modules: %j', err);
        callback(new Error('fail to fetch modules'));
      } else {
        log.info('%d modules fetched.', rows ? rows.length : 0);
        callback(null, rows);
      }
    });
};

var versionsOf = exports.versionsOf = function(moduleId, callback) {
  db.model('Version').findAll({where: {id: moduleId}, order: 'updatedAt DESC'}).complete(function(err, rows) {
    if (err) {
      log.warn('fail to fetch versions of module[%s]: %j', moduleId, err);
      callback(new Error('fail to fetch versions of module'));
    } else {
      log.info('%d version of module [id: %d] fetched.', rows ? rows.length : 0, moduleId);
      callback(null, rows);
    }
  });
};

var getModule = exports.getModule = function(family, name, callback) {
  if (family && typeof family === 'object' && family.family && family.name) {
    callback = name;
    name = family.name;
    family = family.family;
  }

  db.model('Module')
    .findAll({where: { family: family, name: name}, include: [{ model: db.model('Version'), as: 'latestVersion' }] })
    .complete(function(err, row) {
    if (err) {
      log.warn('fail to fetch module:[%s/%s]: %j', family, name, err);
      callback(new Error('fail to fetch module'));
    } else {
      callback(null, row);
    }
  });
};

var getVersion = exports.getVersion = function(moduleId, version, callback) {
  db.model('Version')
    .findAll({ ModuleId: moduleId, version: version })
    .complete(function(err, row){
      if (err) {
        log.warn('fail to fetch version of module[%s @ %s]: %j', moduleId, version, err);
        callback(new Error('fail to fetch version of module'));
      } else {
        callback(null, row);
      }
    });
};

var getModuleWithVersion = exports.getModuleWithVersion = function(family, name, version, callback) {
  if (family && typeof family === 'object' && family.family && family.name && family.version) {
    callback = name;
    name = family.name;
    version = family.version;
    family = family.family;
  }

  async.waterfall([
    function(cb){
      getModule(family, name, cb);
    },
    function(mod, cb) {
      if (!mod) {
        cb(null, null);
        return;
      }
      getVersion(mod.id, version, function(err, ver){
        if (err) {
          cb(err);
        } else {
          cb(null, ver ? _.defaults(mod, ver) : mod);
        }
      });
    }
  ], callback);
};

var removeModule = exports.removeModule = function(family, name, callback) {
  if (family && typeof family === 'object' && family.family && family.name) {
    callback = name;
    name = family.name;
    family = family.family;
  }

  async.waterfall([
    function(cb){
      getModule(family, name, cb);
    },
    function(mod, cb){
      if (!mod) {
        log.info('module [%s/%s] not exists, nothing have to be removed!', family, name);
        return cb();
      }
      /*var qChain = new QueryChainer;
      qChain.add(db.model('Version').destroy({ModuleId: mod.id}));
      qChain.add(mod.destroy());
      qChain.run()*/
      mod.destroy()
        .complete(function(err){
        if (err) {
          log.warn('fail to remove module with all versions [%s/%s]: %j', family, name, err);
          cb(new Error('fail to remove module with all versions'));
        } else {
          log.info('module with ALL versions [%s/%s] removed!', family, name);
          cb();
        }
      })
    }
  ], callback);
};

var updateModule = exports.updateModule = function(mod, callback) {
  if (typeof mod == 'object' && mod && mod.id) {
    db.model('Module').update(mod, {id: mod.id}, function(err){
      if (err) {
        log.warn('fail to update module [id:%d]: %j', module.id, err);
        callback(new Error('fail to update module'));
      } else {
        log.info('module [id:%d] updated!', module.id);
        callback();
      }
    });
  } else {
    log.warn('fail to update module: module.id not exists');
    callback(new Error('fail to update module with id-unknown'));
  }
};

var createVersion = exports.createVersion = function(moduleWithVersion, callback) {
  callback = callback || function(){};
  if (typeof moduleWithVersion != 'object' || !moduleWithVersion) {
    callback(new Error('Zombie module provided!'));
    return;
  }
  var family = moduleWithVersion.family,
      name = moduleWithVersion.name,
      version = moduleWithVersion.version,
      author = moduleWithVersion.author;

  if (!family || !name || !version) {
    callback(new Error("family, name & version of module must be provided"));
    return;
  }
  author = author || 'ANONYMOUS';

  async.waterfall([
    function(cb){
      getModuleWithVersion(family, name, version, cb);
    },
    function (moduleWithVersion, cb) {
      if (moduleWithVersion){
        if (module.version) {
          var msg = util.format('module [%s/%s@%s] already exists!', family, name, version);
          log.warn(msg);
          cb(new Error(msg));
        } else {
          log.debug('add new version to exists module [%s @ %s]', moduleWithVersion.id, version);


          cb(null, sqlAddVersion.template({
            moduleId: moduleWithVersion.id,
            version: version,
            author: author
          }).s);
        }
      } else {
        log.debug('add brand-new module with version [%s/%s@%s]', family, name, version);
        cb(null, sqlCreateVersion.template({
          family: family,
          name: name,
          version: version,
          author: author
        }).s);
      }
    },
    function(sql, cb) {
      db.exec(sql, function(err){
        if (err) {
          log.warn('fail to create version [%s/%s@%s]: %j', family, name, version, err);
          cb(new Error('fail to create version'));
        } else {
          log.info('version [%s/%s@%s] created', family, name, version);
          cb();
        }
      });
    }
  ], callback);
};

var removeVersion = exports.removeVersion = function(family, name, version, callback) {
  if (family && typeof family === 'object' && family.family && family.name) {
    callback = name;
    name = family.name;
    version = family.version;
    family = family.family;
  }

  async.waterfall([
    function(cb){
      getModule(family, name, cb);
    },
    function(module, cb) {
      if (!module) {
        log.info('module [%s/%s] not exists, no version have to be removed!', family, name);
        return cb();
      }

      db.exec(sqlRemoveVersion.template({
        moduleId: module.id,
        version: version
      }).s, function(err){
        if (err) {
          log.warn('fail to remove version of module [%s/%s@%s]: %j', family, name, version, err);
          cb(new Error('fail to remove version of module'));
        } else {
          log.info('version of module [%s/%s@%s] removed!', family, name, version);
          cb();
        }
      });
    }
  ], callback);
};

exports.clear = function(callback) {
  var qChain = new QueryChainer;

  ['Module', 'Version'].forEach(function(modelName){
    qChain.add(db.model(modelName).destroy());
  });

  qChain.run().complete(function(err){
    if (err) {
      log.warn('fail to clear modules & versions: %j', err);
      callback(new Error('fail to clear modules & versions'));
    } else {
      log.info('ALL modules & versions cleared!');
      callback();
    }
  });
};