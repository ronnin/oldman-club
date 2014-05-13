module.exports = function(sequelize, DataTypes) {
  var Version = sequelize.define('Version', {
    version:   { type: DataTypes.STRING(20), allowNull: false, validate: { is: ['^[a-z0-9\\-_]+$', 'i'] } },
    sarFile:   { type: DataTypes.STRING(255) },
    metaFile:  { type: DataTypes.STRING(255) },
    fileSize:  { type: DataTypes.INTEGER },
    author:    { type: DataTypes.STRING(50) },
    keyword:   { type: DataTypes.STRING(255) }
  }, {
    classMethods: {
      associate: function(models) {
        Version.belongsTo(models['Module']);
      }
    }
  });
  return Version;
};