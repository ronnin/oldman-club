module.exports = function(sequelize, DataTypes) {
  var Module = sequelize.define('Module', {
    family:  { type: DataTypes.STRING(50), allowNull: false, validate: { is: ['^[a-z0-9\\-_]+$', 'i'] } },
    name:    { type: DataTypes.STRING(50), allowNull: false, validate: { is: ['^[a-z0-9\\-_]+$', 'i'] } },
    hash:    { type: DataTypes.STRING(255), allowNull: false, unique: true },
    local:   { type: DataTypes.BOOLEAN, default: false }, // TODO: upstream 404, set local true
    versionCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    latestVersion: DataTypes.INTEGER
  }, {
    classMethods: {
      associate: function(models) {
        Module.hasMany(models['Version']);
        Module.hasOne(models['Version'], { as: 'latestVersion' });
      }
    }
  });
  return Module;
};