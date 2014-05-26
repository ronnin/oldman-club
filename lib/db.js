var Sequelize = require('sequelize');
var async = require('async');
var log = require('./logger');
var dbEventEmitter = require('./event').dbEventEmitter;

var sequelize;
var models;
var initialized = false;

function whenInitialized(cb) {
  log.info('database initialized!');
  dbEventEmitter.emit('dbInitialized', models, sequelize);
  initialized = true;
  cb();
}

exports.init = function(options, force, cb){
  if (typeof force == 'function') {
    cb = force;
    force = false;
  }

  if (!sequelize) {
    sequelize = new Sequelize(options.database, options.username, options.password, options);
  }
  if (!models) {
    models = require('../models')(sequelize);
  }

  if (initialized) {
    whenInitialized(cb);
  } else {
    sequelize
      .sync({force: force})
      .done(function (err) {
        if (err) {
          log.error('fail to init database: %j', err);
          cb(new Error('fail to init database'));
        } else {
          whenInitialized(cb);
        }
      });
  }
};