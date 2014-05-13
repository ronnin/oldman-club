var fs = require('fs');
var path = require('path');

module.exports = exports = function(sequelize) {
  var models = {};

  fs.readdirSync(__dirname)
    .filter(function(file){
      return (file.indexOf('.') !== 0) && (file != 'index.js') && (file != 'dependency.js');
    })
    .forEach(function(file){
      var model = sequelize.import(path.join(__dirname, file));
      models[model.name] = model;
    });

  Object.keys(models).forEach(function(modelName){
    var model = models[modelName];
    if (typeof model['associate'] == 'function') {
      model.associate(models);
    }
  });

  return models;
};