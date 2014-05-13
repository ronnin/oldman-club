module.exports = function(sequelize, DataTypes) {
  var Auth = sequelize.define('Auth', {
    token:       DataTypes.STRING(256),
    tokenExpire: DataTypes.DATE
  }, {
    classMethods: {
      associate: function(models) {
        Auth.belongsTo(models['User']);
      }
    }
  });
  return Auth;
};