var async = require('async');
var multiline = require('multiline');
var _ = require('lodash');
var S = require('string');

var log = require('../lib/logger');
var util = require('../lib/util');

// TODO: enable keyword search
var ddl = multiline(function(){/*
  CREATE TABLE IF NOT EXISTS module (
    id              integer PRIMARY KEY AUTOINCREMENT,
    family          varchar(50) NOT NULL,
    name            varchar(50) NOT NULL,
    version_count       int         NOT NULL DEFAULT 0,
    latest_kw       varchar(250),
    latest_author   varchar(50),
    latest_version  varchar(20),
    latest_ts       datetime,
    CONSTRAINT uk_module UNIQUE (family, name)
  );
  CREATE TABLE IF NOT EXISTS module_version (
    module_id     INTEGER       NOT NULL,
    version       varchar(20)   NOT NULL,
    timestamp     datetime      NOT NULL,
    file_lib      varchar(250),
    file_pkg      varchar(250),
    author        varchar(50),
    keyword       varchar(250),
    CONSTRAINT pk_module_version PRIMARY KEY (module_id, version),
    CONSTRAINT fk_module FOREIGN KEY (module_id) REFERENCES module (id)
  );
*/});

var db = require('../lib/db')(ddl);

exports.modules = function(queryOptions, callback) {
  if (typeof queryOptions == 'function') {
    callback = queryOptions;
    queryOptions = {};
  }
  var familyLike = queryOptions.family;
  var nameLike = queryOptions.name;
  var authorLike = queryOptions.authorLike;
  var orderBy = queryOptions.orderBy;
  var inVersionDetail = queryOptions.inVersionDetail;
  callback = callback || function(){};

  var sql = inVersionDetail
              ? 'SELECT m.*, v.* FROM module m, module_version v WHERE m.id=v.module_id AND m.version_count>0'
              : 'SELECT * FROM module m WHERE m.version_count>0';
  if (familyLike && familyLike !== '%') {
    sql += " AND m.family LIKE '" + familyLike + "'";
  }
  if (nameLike && nameLike !== '%') {
    sql += " AND m.name LIKE '" + nameLike + "'";
  }
  if (authorLike && authorLike !== '%') {
    sql += " AND (m.latest_author LIKE '" + authorLike + "'";
    if (inVersionDetail) {
      sql += " OR v.author LIKE '" + authorLike + "'";
    }
    sql += ")";
  }
  if (orderBy) {
    sql += ' ORDER BY m.' + orderBy;
  }
  if (inVersionDetail) {
    sql += (orderBy ? ',' : ' ORDER BY ') + 'm.family,m.name,v.timestamp DESC';
  }

  db.all(sql, function(err, rows){
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
  db.all('SELECT * FROM module_version WHERE module_id=? ORDER BY timestamp DESC', moduleId, function(err, rows){
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
  db.get('SELECT * FROM module WHERE family=? AND name=?', family, name, function(err, row) {
    if (err) {
      log.warn('fail to fetch module:[%s/%s]: %j', family, name, err);
      callback(new Error('fail to fetch module'));
    } else {
      callback(null, row);
    }
  });
};

var getVersion = exports.getVersion = function(moduleId, version, callback) {
  db.get('SELECT * FROM module_version WHERE module_id=? AND version=?', moduleId, version, function(err, row){
      if (err) {
        log.warn('fail to fetch version of module[%s @ %s]: %j', moduleId, version, err);
        callback(new Error('fail to fetch version of module'));
      } else {
        callback(null, row);
      }
    });
};

var getModuleWithVersion = exports.getModuleWithVersion = function(family, name, version, callback) {
  async.waterfall([
    function(cb){
      getModule(family, name, cb);
    },
    function(module, cb) {
      if (!module) {
        cb(null, null);
        return;
      }
      getVersion(module.id, version, function(err, ver){
        if (err) {
          cb(err);
        } else {
          cb(null, ver ? _.defaults(module, ver) : module);
        }
      });
    }
  ], callback);
};

var sqlRemoveModule = S(multiline(function(){/*
  -- BEGIN;
    DELETE FROM module_version WHERE module_id={{moduleId}};
    DELETE FROM module WHERE id={{moduleId}};
  -- END;
*/}));
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
    function(module, cb){
      if (!module) {
        log.info('module [%s/%s] not exists, nothing have to be removed!', family, name);
        return cb();
      }
      db.exec(sqlRemoveModule.template({moduleId: module.id}).s, function(err){
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

var sqlUpdateModule = S(multiline(function(){/*
  UPDATE module SET
                   family='{{family}}'
                 , name='{{name}}'
                 -- more
   WHERE id={{id}};
*/}));
var updateModule = exports.updateModule = function(module, callback) {
  db.exec(sqlUpdateModule.template(module).s, function(err){
    if (err) {
      log.warn('fail to update module [id:%d]: %j', module.id, err);
      callback(new Error('fail to update module'));
    } else {
      log.info('module [id:%d] updated!', module.id);
      callback();
    }
  });
};

var sqlAddVersion = S(multiline(function(){/*
 -- BEGIN;
    INSERT INTO module_version (module_id, version, timestamp, author)
         VALUES ({{moduleId}}, '{{version}}', datetime('now','localtime'), '{{author}}');
    UPDATE module SET
                     version_count=version_count+1,
                     latest_version='{{version}}',
                     latest_ts=datetime('now','localtime'),
                     latest_author='{{author}}'
     WHERE id={{moduleId}};
 -- END;
*/}));
var sqlCreateVersion = S(multiline(function(){/*
 -- BEGIN;
    INSERT INTO module (family, name, version_count, latest_version, latest_ts, latest_author)
         VALUES ('{{family}}', '{{name}}', 1, '{{version}}', datetime('now','localtime'), '{{author}}');
    INSERT INTO module_version (module_id, version, timestamp, author)
         SELECT id, latest_version, latest_ts, latest_author
           FROM module
          WHERE family='{{family}}'
            AND name='{{name}}';
 -- END;
*/}));
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

var sqlRemoveVersion = S(multiline(function(){/*
 -- BEGIN;
    DELETE FROM module_version WHERE module_id={{moduleId}} AND version='{{version}}';
    UPDATE module SET
           latest_version = (SELECT version FROM module_version WHERE module_id={{moduleId}} ORDER BY timestamp DESC LIMIT 1),
           latest_ts = (SELECT max(timestamp) FROM module_version WHERE module_id={{moduleId}}),
           latest_author =  (SELECT author FROM module_version WHERE module_id={{moduleId}} ORDER BY timestamp DESC LIMIT 1),
           version_count = (SELECT count(version) FROM module_version WHERE module_id={{moduleId}})
     WHERE id={{moduleId}}
 -- END;
*/}));
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

var sqlClear = multiline(function(){/*
 -- BEGIN;
    DELETE FROM module_version;
    DELETE FROM module;
 -- END;
*/});
exports.clear = function(callback) {
  db.exec(sqlClear, function(err){
    if (err) {
      log.warn('fail to clear modules & versions: %j', err);
      callback(new Error('fail to clear modules & versions'));
    } else {
      log.info('ALL  modules & versions cleared!');
      callback();
    }
  });
};