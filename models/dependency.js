module.exports = function(sequelize, DataTypes) {
  var Dependency = sequelize.define('Dependency', {
    master:     DataTypes.INTEGER,
    dependant:  DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        Dependency.hasOne(models['Version'], { as: 'master' });
        Dependency.hasOne(models['Version'], { as: 'dependant' });
      }
    }
  });
  return Dependency;
};