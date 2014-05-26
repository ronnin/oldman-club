var _models, _sequelize;
require('../lib/event').dbEventEmitter.once('dbInitialized', function(models, sequelize){
  _models = models;
  _sequelize = sequelize;
});

exports.sequelize = function(){
  if (!_sequelize) {
    log.error('sequelize not set! set sequelize when event [dbInitialized] emitted!');
    throw new Error('model not set');
  }
  return _sequelize;
};

exports.model = function(name) {
  if (!_models) {
    log.error('model User not set! set models when event [dbInitialized] emitted!');
    throw new Error('model not set');
  }
  return _models[name];
};
