var async = require('async');
var Sequelize = require('sequelize');
var QueryChainer = Sequelize.Utils.QueryChainer;
var _ = require('lodash');

var log = require('../lib/logger');
var util = require('../lib/util');
var modelProvider = require('./modelProvider');
var common = require('./common');

var sequelize = modelProvider.sequelize;
var Module = modelProvider.model.bind(null, 'Module');
var Version = modelProvider.model.bind(null, 'Version');
var Dependency = modelProvider.model.bind(null, 'Dependency');


/**
 *
 * @param queryOptions {{
 *  family: like pattern of family,
 *  name: like pattern of name,
 *  local: boolean wheather is local
 *
 *  orderBy: order by clause.
 *          every column of table modules can be used directly.
 *          every column of table versions can be used with 'latest.' prefix can be used for order by latestVersion;
 *          every column of table versions can be used with 'version.' prefix can be used for order by versions;
 *
 * }}
 * @param callback
 */
exports.modules = function(queryOptions, callback) {
  if (typeof queryOptions == 'function') {
    callback = queryOptions;
    queryOptions = {};
  }
  callback = callback || function(){};

  var familyLike = queryOptions.family;
  var nameLike = queryOptions.name;

  var where = ['1=1'];
  if (familyLike && familyLike !== '%') {
    where.push(['family LIKE ?', familyLike]);
  }
  if (nameLike && nameLike !== '%') {
    where.push(['name LIKE ?', nameLike]);
  }
  if (typeof queryOptions.local == 'boolean') {
    where.push(['local=?', common.bool2Int(queryOptions.local)]);
  }

  var orderBy = queryOptions.orderBy || ['family', 'name'];
  if (Array.isArray(orderBy)) {
    orderBy = orderBy.map(function(item){
      if (/^latest\\..+$/i.test(item)) {
        return [{model: Version(), as: 'latestVersion'}].concat(common.normalizeOrderBy(item.substring('latest.'.length)));
      }
      if (/^version\\..+$/i.test(item)) {
        return [Version()].concat(common.normalizeOrderBy(item.substring('version.'.length)));
      }
      return item;
    });
  } else {
    orderBy = [common.normalizeOrderBy(orderBy)];
  }

  var includes = [{ model: Version(), as: 'latestVersion' }];
  if (queryOptions.includeVersions) {
    includes.push(Version());
    orderBy.push([Version(), 'updatedAt', 'DESC']);
  }

  Module()
    .findAll({where: Sequelize.and.apply(null, where), order: orderBy, include: includes})
    .done(function(err, modules){
      if (err) {
        log.warn('fail to fetch modules: %j', err);
        callback(new Error('fail to fetch modules'));
      } else {
        log.info('%d modules fetched.', modules ? modules.length : 0);
        callback(null, modules);
      }
    });
};

var moduleOf = exports.moduleOf = function(id, callback) {
  Module()
    .find({ where: { id: id }, include: [{ model: Version(), as: 'latestVersion' }] })
    .done(function(err, mod) {
      if (err) {
        log.warn('fail to fetch module [id: %d]: %j.', id, err);
        return callback(new Error('fail to fetch module'));
      }

      if (!mod) {
        log.warn('fail to fetch module [id: %d]: not exists!', id);
      }
      callback(null, mod);
    });
};

var versionOf = exports.versionOf = function(id, callback) {
  Version()
    .find({ where: { id: id }, include: [ Module() ]})
    .done(function(err, ver) {
      if (err) {
        log.warn('fail to fetch version [id: %d]: %j.', id, err);
        return callback(new Error('fail to fetch version'));
      }

      if (!ver) {
        log.warn('fail to fetch version [id: %d]: not exists!', id);
      }
      callback(null, ver);
    });
};

var versionsOf = exports.versionsOf = function(mod, callback) {
  async.waterfall([
    function(cb){
      if (mod && typeof mod == 'object' && typeof mod['getVersions'] == 'function') {
        cb(null, mod);
      } else {
        moduleOf(mod, cb); // param mod is id of module
      }
    },
    function(mod, cb){
      if (!mod) {
        return cb(null, null);
      }

      mod
        .getVersions({
          include: [{
            model: Module(),
            include: [{model: Version(), as: 'latestVersion'}]
          }],
          order: 'updatedAt DESC'
        })
        .done(function(err, versions) {
          if (err) {
            log.warn('fail to fetch versions of module[%s/%s]: %j', mod.family, mod.name, err);
            cb(new Error('fail to fetch versions of module'));
          } else {
            log.info('%d versions of module [%s/%s] fetched.', (versions ? versions.length : 0), mod.family, mod.name);
            cb(null, versions);
          }
        });
    }
  ], callback);
};

exports.dependenciesOf = function(version, callback) {
  async.waterfall([
    function(cb){
      if (version && typeof version == 'object' && typeof version['getDependencies'] == 'function') {
        cb(null, version);
      } else {
        versionOf(version, cb); // param version is id of version
      }
    },
    function(ver, cb) {
      ver
        .getDependencies({ include: { model: Version(), as: 'dependant' }})
        .done(function(err, dependencies){
          if (err) {
            log.warn('fail to fetch dependencies of module[%s/%s@%%s]: %j',
              ver.module.family, ver.model.name, ver.version, err);
            cb(new Error('fail to fetch dependencies of module'));
          } else {
            log.info('%d dependencies of module [%s/%s@%s] fetched.',
              (dependencies ? dependencies.length : 0), ver.module.family, ver.model.name, ver.version);
            cb(null, dependencies);
          }
        });
    }
  ], callback);
};

exports.updateDependencies = function(version, dependencies, callback) {

};

var getModule = exports.getModule = function(family, name, includeVersions, callback) {
  if (family && typeof family === 'object' && family.family && family.name) {
    if (typeof name == 'function') {
      callback = name;
      includeVersions = false;
    } else {
      callback = includeVersions;
      includeVersions = name;
    }

    name = family.name;
    family = family.family;
  } else {
    if (typeof includeVersions == 'function') {
      callback = includeVersions;
      includeVersions = false;
    }
  }
  callback = callback || function(){};

  var includes = [{ model: Version(), as: 'latestVersion' }];
  var orders = ['id'];
  if (includeVersions) {
    includes.push(Version());
    orders.push([Version(), 'updatedAt', 'DESC']);
  }

  Module()
    .find({where: { family: family, name: name}, include: includes, order: orders })
    .done(function(err, mod) {
    if (err) {
      log.warn('fail to fetch module [%s/%s]: %j', family, name, err);
      callback(new Error('fail to fetch module'));
    } else {
      if (!mod) {
        log.warn('fail to fetch module [%s/%s]: not exists!', family, name);
      }
      callback(null, mod);
    }
  });
};

var getVersion = exports.getVersion = function(mod, version, callback) {
  async.waterfall([
    function(cb){
      if (mod && typeof mod == 'object' && typeof mod['getVersions'] == 'function') {
        cb(null, mod);
      } else {
        moduleOf(mod, cb); // param mod is module.id
      }
    },
    function(mod, cb){
      if (!mod) {
        return cb(null, null);
      }

      mod
        .getVersions({where: { version: version}, include: [ Module() ] })
        .done(function(err, versions){
          if (err) {
            log.warn('fail to fetch version [%s/%s@%s]: %j.', mod.family, mod.name, version, err);
            return cb(new Error('fail to fetch version'));
          }
          if (!versions || !versions.length) {
            log.warn('fail to fetch version [%s/%s@%s]: not exists.', mod.family, mod.name, version);
            return cb(null, null);
          }
          cb(null, versions[0]);
        });
    }
  ], callback);
};

/**
 * if module(family/name) exists but version(version) not exists, return module instance without module.version,
 * if both module (family/name) and version(version) exists, return module instance with module.version available,
 * otherwise return null;
 */
var getModuleWithVersion = exports.getModuleWithVersion = function(family, name, version, callback) {
  if (family && typeof family === 'object' && family.family && family.name && family.version) {
    callback = name;
    name = family.name;
    version = family.version;
    family = family.family;
  }

  async.waterfall([
    getModule.bind(null, family, name),
    function(mod, cb) {
      if (!mod) {
        return cb(null, null);
      }
      getVersion(mod, version, function(err, ver){
        if (mod && ver) {
          mod.setDataValue('version', ver);
        } else {
          log.warn('fail to fetch moduleWithVersion [%s/%s@%s]: not exists!', family, name, version);
        }

        return cb(null, mod);
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
    getModule.bind(null, family, name),
    function(mod, cb){
      if (!mod) {
        log.info('module [%s/%s] not exists, nothing have to be removed!', family, name);
        return cb();
      }
      var qChain = new QueryChainer;

      qChain.add(common.cleanChildrenFn(mod.id, Module(), Version(), 'getVersions'));
      qChain.add(mod.destroy());
      qChain.run()
        .done(function(err){
        if (err) {
          log.warn('fail to remove module with all versions [%s/%s]: %j.', family, name, err);
          cb(new Error('fail to remove module with all versions'));
        } else {
          log.info('module with ALL versions [%s/%s] removed!', family, name);
          cb();
        }
      })
    }
  ], callback);
};

var updateModule = exports.updateModule = function(mod, id, callback) {
  if (!mod || typeof mod !== 'object' || !id) {
    log.warn('fail to update module: unknown id');
    return callback(new Error('fail to update module: unknown id'));
  }

  Module()
    .update(mod.values || mod, {id: id})
    .success(function(affectedRows){
      if (affectedRows == 1) {
        log.info('module [id:%d] updated!', id);
      } else {
        log.warn('no target module exists [id:%d] for updating!', id);
      }

      callback();
    })
    .error(function(err){
        log.warn('fail to update module [id:%d]: %j', id, err);
        callback(new Error('fail to update module'));
    });
};

function deleteVersion(version, callback) {
  var qChain = new QueryChainer;

  var fnc = common.cleanChildrenFn(version.id, Version(), Dependency(), 'getDependencies');
  if (fnc) qChain.add(fnc);
  qChain.add(version.destroy());

  qChain
    .run()
    .success(function(){
      log.info('version [%d] and it\'s dependencies removed', version.id);
      callback();
    })
    .error(function(err){
      log.warn('fail to remove version [%d] and it\'s dependencies: %j.', version.id, err);
      callback(new Error('fail to remove version and it\'s dependencies'));
    });
}

var createModuleWithVersion = exports.createModuleWithVersion = function(moduleWithVersion, force, callback) {
  if (typeof force === 'function') {
    callback = force;
    force = false;
  }
  callback = callback || function(){};

  if (typeof moduleWithVersion != 'object' || !moduleWithVersion) {
    log.warn('fail to create ModuleWithVersion: zombie provided!');
    return callback(new Error('fail to create ModuleWithVersion: zombie provided!'));
  }
  var family = moduleWithVersion.family,
      name = moduleWithVersion.name,
      version = moduleWithVersion.version;

  var verObj;
  if (typeof version == 'object') {
    verObj = version;
    version = verObj.version;
  } else {
    verObj = _.omit(moduleWithVersion, ['family', 'name']);
  }

  if (!family || !name || !version) {
    log.warn('fail to create ModuleWithVersion: family/name/version cannot be EMPTY!');
    return callback(new Error('fail to create ModuleWithVersion: family/name/version cannot be EMPTY!'));
  }

  async.waterfall([
    getModuleWithVersion.bind(null, family, name, version),
    function(mod, cb) {
      if (mod) {
        log.info('module %s/%s already exists!', family, name);
        return cb(null, mod);
      }

      Module()
        .create(_.omit(moduleWithVersion, 'version'))
        .done(function(err, mod){
          if (err) {
            log.error('fail to create Module %s/%s: %j.', family, name, err);
            return cb(err);
          }
          log.info('module %s/%s saved!', family, name);
          cb(null, mod);
        });
    },
    function(mod, cb){
      var ver = mod.getDataValue('version');
      if (!ver) {
        return cb(null, mod);
      }

      log.warn('module [%s/%s@%s] already exists!', family, name, version);
      if (!force) {
        return cb(new Error('fail to create ModuleWithVersion: module already exists!'));
      }

      log.info('remove legacy module [%s/%s@%s], before forced creation again.', family, name, version);
      deleteVersion(ver, function(err){
        if (err) {
          log.warn('fail to remove legacy module [%s/%s@%s]: %j', family, name, version, err);
          cb(new Error('fail to remove legacy module version'));
        } else {
          cb(null, mod);
        }
      });
    },
    function (mod, cb) {
      mod
        .createVersion(verObj)
        .done(function(err, ver){
          if (err) {
            log.error('fail to create module version [%s/%s@%s]: %j', family, name, version, err);
            return cb(new Error('fail to create module version'));
          }
          log.info('module version [%s/%s@%s] saved!', family, name, version);
          cb(null, ver, mod);
        });
    },
    setLatestVersion
  ], callback);
};

function setLatestVersion(latest, mod, cb) {
  mod
    .setLatestVersion(latest)
    .done(function(err, mod){
      if (err) {
        log.error('fail to set latest [%s/%s@%s]: %j', mod.family, mod.name, latest && latest.version, err);
        return cb(new Error('fail to set latest'));
      }
      log.info('module set [%s/%s@%s] as latest!', mod.family, mod.name, latest && latest.version);
      mod.setDataValue('latestVersion', latest);
      cb(null, mod);
    });
}

var removeVersion = exports.removeVersion = function(family, name, version, callback) {
  if (family && typeof family === 'object' && family.family && family.name) {
    callback = name;
    name = family.name;
    version = family.version;
    family = family.family;
  }

  async.waterfall([
    getModuleWithVersion.bind(null, family, name, version),
    function(mod, cb){
      if (!mod || !(mod.getDataValue('version'))) {
        log.info('module [%s/%s@%s] not exists, no version have to be removed!', family, name, version);
        return cb(null, null, null);
      }
      var verToBeRemove = mod.getDataValue('version');
      var latest = !mod.getDataValue('latestVersion') || mod.getDataValue('latestVersion').id == verToBeRemove.id;
      deleteVersion(verToBeRemove, function(err){
        if (err) {
          return cb(err);
        }
        log.info('module [%s/%s@%s] removed.', family, name, version);
        mod.setDataValue('version', null);
        cb(null, mod, latest);
      });
    },
    function(mod, latest, cb){
      if (!latest) {
        return cb(null, mod);
      }

      async.waterfall([
        function(cbi){
          mod
            .getVersions({order: 'updatedAt DESC', limit: 1})
            .done(function(err, versions){
              if (err || !versions || !versions.length) {
                log.warn('fail to fetch latest version [%s/%s]: %j.', mod.family, mod.name, err);
                return cbi(null, null, mod);
              }
              cbi(null, versions[0], mod);
            });
        },
        setLatestVersion
      ], cb);
    }
  ], callback);
};

exports.clear = function(callback) {
  var qChain = new QueryChainer;

  qChain.add(Dependency().destroy());
  qChain.add(Version().destroy());
  qChain.add(Module().destroy());

  qChain
    .run()
    .success(function(){
      log.info('ALL modules & versions cleared!');
      callback();
    })
    .error(function(err){
      log.warn('fail to clear modules & versions: %j', err);
      callback(new Error('fail to clear modules & versions'));
    });
};