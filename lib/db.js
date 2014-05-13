var Sequelize = require('sequelize');
var async = require('async');
var log = require('./logger');

var models;
var sequelize;
var initialized = false;

exports.init = function(options, cb){
  sequelize = new Sequelize(options.database, options.username, options.password, options);
  models = require('../models')(sequelize);
  sequelize.sync().complete(function(err){
    if (err) {
      log.error('fail to init database: %j', err);
      cb(new Error('fail to init database'));
    } else {
      log.info('database synchronized!');
      cb(null, {models: models, sequelize: sequelize});
      initialized = true;
    }
  });
};

exports.model = function(name){
  if (!initialized) {
    log.error('DB not initialized yet!');
    return null;
  }
  if (name) {
    return models[name];
  }
  return models;
};

exports.sequelize = function(){
  if (!initialized) {
    log.error('DB not initialized yet!');
    return null;
  }
  return sequelize;
};