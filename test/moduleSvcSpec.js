/*global describe, it, beforeEach, afterEach, before, after*/
var should = require('should');
var async = require('async');
var _= require('lodash');

var util = require('../lib/util');
var userSvc = require('../services/userSvc');

var env = require('./env');
// ! Test Target !
var moduleSvc = require('../services/moduleSvc');

describe('moduleSvc', function(){
  var initialUsers = [
    { username: 'joe',  password: 'secure',             active: false },
    { username: 'lily', password: 'secure', admin: true },
    { username: 'kate', password: 'secure', admin: true },
    { username: 'mary', password: 'secure' }
  ];
  var initialModules = [
    { family: 'jquery', name: 'jquery', version: '1.8.7' },
    { family: 'jquery', name: 'jquery', version: '1.9.2' },
    { family: 'jquery', name: 'jquery', version: '1.11.0' },
    { family: 'jquery', name: 'jquery', version: '2.1.0' },
    { family: 'lodash', name: 'lodash', version: '2.1.1' },
    { family: 'lodash', name: 'lodash', version: '2.4.1' },
    { family: 'async', name: 'async', version: '1.22' },
    { family: 'component', name: 'upload', version: '0.1.1' },
    { family: 'component', name: 'progress', version: '0.0.4' },
    { family: 'component', name: 'selectable', version: '0.1.0' },
    { family: 'component', name: 'tween', version: '1.1.0' },
    { family: 'twbs', name: 'bootstrap', version: '3.1.1' },
    { family: 'twbs', name: 'bootstrap', version: '2.3.2' },
    { family: 'd3', name: 'd3', version: '3.4.6' },
    { family: 'normalize.css', name: 'normalize.css', version: '3.0.1' },
    { family: 'animate.css', name: 'animate.css', version: '3.1.1' },
    { family: 'font-awesome', name: 'font-awesome', version: '4.0.3' },
    { family: 'modernizr', name: 'modernizr', version: '2.7.2' },
    { family: 'select2', name: 'select2', version: '3.4.6' },
    { family: 'enyo', name: 'opentip', version: '2.4.6' },
    { family: 'enyo', name: 'dropzone', version: '3.8.5' },
    { family: 'moment', name: 'moment', version: '2.6.0' },
    { family: 'jquery-plugins', name: 'jquery-pjax', version: '1.8.2' },
    { family: 'jquery-plugins', name: 'jquery-form', version: '3.5.0' },
    { family: 'jquery-plugins', name: 'jquery-cycle', version: '3.0.3' }
  ];

  var initialModulesStat = {};

  before(function(done){
    initialModules.forEach(function(mod){
      var hash = util.hashOf(mod.family, mod.name);
      var stat = initialModulesStat[hash] || {count : 0, versions: [], family: mod.family, name: mod.name};
      stat.count += 1;
      stat.latest = mod.version;
      stat.versions.push(mod.version);
      initialModulesStat[hash] = stat;
    });

    async.series([
      env.init,
      userSvc.clear,
      async.eachSeries.bind(null, initialUsers, userSvc.create)
    ], done);
  });

  after(userSvc.clear);

  beforeEach(function(done){
    async.series([
      moduleSvc.clear,
      async.eachSeries.bind(null, initialModules, moduleSvc.createModuleWithVersion)
    ], done);
  });


  it('can fetch all modules', function(done){
    moduleSvc.modules(function(err, modules){
      should.not.exists(err);
      should(modules).be.an.Array;
      should(modules.length).eql(Object.keys(initialModulesStat).length);

      modules.forEach(function(mod){
        should(mod).have.properties('family', 'name', 'latestVersion');
        var f = mod.getDataValue('family'), n = mod.getDataValue('name');
        should(f).be.ok;
        should(n).be.ok;
        should(mod.getDataValue('latestVersion')).have.properties('version');

        var stat = initialModulesStat[util.hashOf(f, n)];
        should(stat).be.ok.and.be.an.Object;
        should(mod.getDataValue('latestVersion').getDataValue('version')).eql(stat.latest);
      });

      done();
    });
  });

  it('can fetch all modules with versions', function(done) {
    moduleSvc.modules({
      includeVersions: true
    }, function(err, modules){
      should.not.exists(err);
      should(modules).be.an.Array;
      should(modules.length).eql(Object.keys(initialModulesStat).length);

      modules.forEach(function(mod){
        should(mod).have.properties('family', 'name', 'versions', 'latestVersion');
        var f = mod.getDataValue('family'), n = mod.getDataValue('name');
        should(f).be.ok;
        should(n).be.ok;
        should(mod.getDataValue('latestVersion')).have.properties('version');

        var stat = initialModulesStat[util.hashOf(f, n)];
        should(stat).be.ok.and.be.an.Object;
        should(mod.getDataValue('latestVersion').getDataValue('version')).eql(stat.latest);

        should(mod.versions).be.an.Array.and.have.length(stat.count);
        var vs = mod.versions.map(function(ver){ return ver.version });
        should(vs.sort()).eql(stat.versions.sort());
      });

      done();
    });
  });

  it('can fetch modules by like-pattern upon family&name', function(done){
    var patterns = [{
      family: ['%e%', /^.*e.*$/]
    },{
      family: ['%o%', /^.*o.*$/],
      name: ['%o%', /^.*o.*$/]
    },{
      family: ['%.css', /^.*\.css$/]
    }, {
      family: ['jquery%', /^jquery.*$/]
    }, {
      name: ['%en%', /^.*en.*$/]
    }];
    async.each(patterns, function(pattern, cb){
      var hashOfModuleExpected = [];
      Object.keys(initialModulesStat).forEach(function(hash) {
        var stat = initialModulesStat[hash];
        if ( (!pattern.family || pattern.family[1].test(stat.family))
          && (!pattern.name || pattern.name[1].test(stat.name)) ) {
          hashOfModuleExpected.push(hash);
        }
      });
      hashOfModuleExpected.sort();

      moduleSvc.modules({
        family: pattern.family && pattern.family[0],
        name: pattern.name && pattern.name[0]
      }, function(err, rows) {
        should.not.exists(err);

        should(rows).be.an.Array;
        should(rows.length).eql(hashOfModuleExpected.length);
        var actual = rows.map(function(row){
          should(row).have.properties('family', 'name');
          should(row.family).be.ok;
          should(row.name).be.ok;
          return util.hashOf(row.family, row.name);
        });
        actual.sort();
        should(actual).eql(hashOfModuleExpected);

        cb();
      });
    }, done);
  });

  it('can fetch all versions of specific module', function(done){
    async.each(Object.keys(initialModulesStat), function(h, callback) {
      var stat = initialModulesStat[h];
      async.waterfall([
        moduleSvc.getModule.bind(null, stat.family, stat.name),
        function(mod, cb) {
          should(mod).have.properties('id');
          should(mod.id).be.ok;
          moduleSvc.versionsOf(mod, function(err, versions){
            should.not.exists(err);
            should(versions).be.an.Array;
            should(versions.map(function(ver){
              should(ver).have.properties('version');
              return ver.version;
            }).sort()).eql(stat.versions.sort());

            cb();
          });
        }
      ], callback);
    }, done)
  });

  it('can create new version', function(done){
    var testData = [
      { family: 'ronnin', name: 'util', versions: ['0.0.1','0.0.2','0.0.3'] },
      { family: 'popeye', name: 'rope', versions: ['1.0.1','1.0.2','1.0.3'] },
      { family: 'any', name: 'thing', versions: ['1.0.1-alpha1','1.0.2-alpha1','1.0.3-alpha1'] }
    ];

    async.each(testData, function(d, callback){
      async.eachSeries(d.versions, function(version, cb){
        moduleSvc.createModuleWithVersion(_.extend({version: version}, d), function(err, mod){
          should.not.exists(err);

          should(mod).be.an.Object;

          should(mod.getDataValue('family')).eql(d.family);
          should(mod.getDataValue('name')).eql(d.name);
          var latest = mod.getDataValue('latestVersion');
          should(latest.getDataValue('version')).eql(version);

          cb();
        });
      }, function(err){
        should.not.exists(err);

        moduleSvc.getModule(d.family, d.name, true, function(err, mod){
          should.not.exists(err);

          should(mod).be.an.Object;
          should(mod.getDataValue('family')).eql(d.family);
          should(mod.getDataValue('name')).eql(d.name);
          var latest = mod.getDataValue('latestVersion');
          should(latest.getDataValue('version')).eql(d.versions[d.versions.length - 1]);

          var versions = mod.getDataValue('versions');
          should(versions).be.an.Array;
          should(versions.length).eql(d.versions.length);
          should(versions.map(function(ver){
            should(ver).have.properties('version');
            return ver.version;
          }).sort()).eql(d.versions.sort());

          callback();
        });
      });
    }, done);
  });

  it('can remove specific version', function(done){
    async.eachSeries(initialModules, function(mod, cb){
      moduleSvc.removeVersion(mod.family, mod.name, mod.version, function(err){
        should.not.exists(err);

        moduleSvc.getModuleWithVersion(mod.family, mod.name, mod.version, function(err, moduleWithVersion){
          should.not.exists(err);
          if (moduleWithVersion) {
            should(moduleWithVersion).be.Object;

            var latest = moduleWithVersion.getDataValue('latestVersion');
            if (latest) {
              should(latest).have.properties('version');
              should(latest.getDataValue('version')).not.eql(mod.version);
            }
          }

          cb();
        });
      });
    }, done);
  });

  it('can remove module with all versions', function(done){
    async.eachSeries(initialModules, function(mod, cb){
      moduleSvc.removeModule(mod.family, mod.name, function(err){
        should.not.exists(err);

        moduleSvc.getModule(mod.family, mod.name, function(err, ret){
          should.not.exists(err);
          should.not.exists(ret);

          cb();
        });
      });
    }, done);
  });

  it('can update module', function(done){
    async.waterfall([
      moduleSvc.modules,
      function(modules, callback) {
        async.each(modules, function(mod, cb){
          var newFamily = util.randomString(),
              newName = util.randomString();

          async.waterfall([
            moduleSvc.updateModule.bind(null, {
              family: newFamily,
              name: newName
            }, mod.id),
            moduleSvc.getModule.bind(null, newFamily, newName)
          ], function(err, ret){
            should.not.exists(err);
            should(ret).have.property('id');
            should(ret.getDataValue('id')).eql(mod.id);

            cb();
          });
        }, callback);
      }
    ], done);
  });

});
