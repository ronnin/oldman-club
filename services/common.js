exports.cleanChildrenFn = function(parentId, parentModel, childModel, getMethodName) {
  var associations = parentModel.associations;
  var ret = Object.keys(associations).filter(function(associationName){
    var ass = associations[associationName];
    return ass.source == parentModel && ass.target == childModel &&
      (!getMethodName || ass.accessors['get'] == getMethodName);
  });
  if (!ret || !ret.length) {
    return null;
  }

  var opt = {};
  opt[associations[ret[0]].identifier] = parentId;
  return childModel.destroy(opt);
};

exports.normalizeOrderBy = function (orderBy) {
  return orderBy.split(' ').map(function(s){
    return s.trim();
  })
};

exports.bool2Int = function(bool) {
  return bool ? 1 : 0;
};