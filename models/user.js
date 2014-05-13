module.exports = function(sequelize, DataTypes) {
  var User = sequelize.define('User', {
    username:   { type: DataTypes.STRING(50),   allowNull: false, unique: true },
    password:   { type: DataTypes.TEXT,         allowNull: false },
    nickname: DataTypes.STRING(50),
    oAuthSrc: DataTypes.STRING(30),
    oAuthId:  DataTypes.STRING(50),
    admin:      { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: false },
    active:     { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: true }
  }, {
    classMethods: {
      associate: function(models) {
        User.hasMany(models['Auth']);
      }
    }
  });
  return User;
};