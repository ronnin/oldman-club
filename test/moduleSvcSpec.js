/*global describe, it, beforeEach, afterEach, before, after*/
var should = require('should');
var async = require('async');
var _= require('lodash');
var db = require('../lib/db');
//var dbOptions = require('../conf/db-sqlite-test');
var dbOptions = require('../conf/db-mysql');
//var dbOptions = require('../conf/db-mariadb');
var util = require('../lib/util');
var userSvc = require('../services/userSvc');

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
    async.series([
      db.init.bind(null, dbOptions),
      userSvc.clear,
      async.eachSeries.bind(null, initialUsers, userSvc.create),
      function(cb){
        initialModules.forEach(function(module, index){
          var hash = util.hashOf(module.family, module.name);
          var stat = initialModulesStat[hash] || {count : 0, originIndexes: {}, family: module.family, name: module.name};
          stat.count += 1;
          stat.latest = module.version;
          stat.originIndexes[module.version] = index;
          initialModulesStat[hash] = stat;
        });
        cb();
      }
    ], done);
  });

  after(userSvc.clear);

  beforeEach(function(done){
    async.series([
      moduleSvc.clear,
      async.eachSeries.bind(null, initialModules, moduleSvc.createVersion)
    ], done);
  });


  it('can fetch all modules', function(done){
    moduleSvc.modules(function(err, modules){
      should.not.exists(err);
      should(modules).is.Array.and.have.length(Object.keys(initialModulesStat).length);
      done();
    });
  });
  /*
  it('can fetch all modules with versions', function(done) {
    moduleSvc.modules({
      inVersionDetail: true
    }, function(err, mvs){
      should.not.exists(err);
      should(mvs).is.Array.and.have.length(initialModules.length);

      mvs.forEach(function(mv){
        should(mv).have.properties('family', 'name', 'version', 'latest_version', 'version_count');
        should(mv.family).be.ok;
        should(mv.name).be.ok;

        var stat = initialModulesStat[util.hashOf(mv.family, mv.name)];
        should(stat).be.ok.and.is.an.Object;
        should(mv.latest_version).equal(stat.latest);
        should(mv.version_count).equal(stat.count);

        var originIndex = stat.originIndexes[mv.version];
        var origin = initialModules[originIndex];
        should(origin).have.properties('family', 'name', 'version');
        should(mv.version).equal(origin.version);
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
      var expectedMVs = initialModules.filter(function(module) {
        return (!pattern.family || pattern.family[1].test(module.family))
          && (!pattern.name || pattern.name[1].test(module.name));
      });
      var hashOfModuleExpected = [];
      var hashOfMVExpected = expectedMVs.map(function(mv){
        var hash = util.hashOf(mv.family, mv.name);
        if (hashOfModuleExpected.indexOf(hash) < 0) {
          hashOfModuleExpected.push(hash);
        }

        return util.hashOf(mv.family, mv.name, mv.version);
      });
      hashOfModuleExpected.sort();
      hashOfMVExpected.sort();

      async.each([true, false], function(inVersionDetail, cb1){
        moduleSvc.modules({
          family: pattern.family && pattern.family[0],
          name: pattern.name && pattern.name[0],
          inVersionDetail: inVersionDetail
        }, function(err, rows) {
          should.not.exists(err);

          var expected = inVersionDetail ? hashOfMVExpected : hashOfModuleExpected;
          should(rows).is.an.Array.and.have.length(expected.length);
          var actual = rows.map(function(row){
            should(row).have.properties('family', 'name');
            should(row.family).be.ok;
            should(row.name).be.ok;
            if (inVersionDetail) {
              should(row).have.properties('version');
              should(row.version).be.ok;
              return util.hashOf(row.family, row.name, row.version);
            } else {
              return util.hashOf(row.family, row.name);
            }
          });
          actual.sort();
          should(actual).eql(expected);

          cb1();
        });
      }, cb);
    }, done);
  });

  it('can fetch all versions of specific module', function(done){
    async.each(Object.keys(initialModulesStat), function(h, callback) {
      var stat = initialModulesStat[h];
      async.waterfall([
        function(cb){
          moduleSvc.getModule(stat.family, stat.name, cb);
        }, function(module, cb) {
          should(module).have.properties('id');
          should(module.id).be.ok;
          moduleSvc.versionsOf(module.id, function(err, versions){
            should.not.exists(err);
            should(versions).is.an.Array;
            var expectedVersions = Object.keys(stat.originIndexes).sort();
            should(versions.map(function(ver){
              should(ver).have.properties('version');
              return ver.version;
            }).sort()).eql(expectedVersions);

            cb();
          });
        }
      ], callback);
    }, done)
  });

  it('can create new version', function(done){
    var testData = [
      { family: 'ronnin', name: 'util', author: 'ronnin', versions: ['0.0.1','0.0.2','0.0.3'] },
      { family: 'popeye', name: 'rope', author: 'PopEye', versions: ['1.0.1','1.0.2','1.0.3'] },
      { family: 'any', name: 'thing', versions: ['1.0.1-alpha1','1.0.2-alpha1','1.0.3-alpha1'] }
    ];

    async.each(testData, function(d, cb){
      d._created = [];

      async.eachSeries(d.versions, function(version, cb1){
        moduleSvc.createVersion(_.extend({version: version}, d), function(err){
          should.not.exists(err);
          d._created.push(version);

          // get back (all versions), & check
          async.each(d._created, function(verCreated, cb2){
            moduleSvc.getModuleWithVersion(d.family, d.name, verCreated, function(err, moduleWithVersion) {
              should.not.exists(err);
              should(moduleWithVersion).have.properties({
                family: d.family,
                name: d.name,
                version_count: d._created.length,
                latest_version: version,
                version: verCreated,
                author: d.author || 'ANONYMOUS'
              });
              cb2();
            });
          }, cb1);
        });
      }, cb);
    }, done);
  });

  it('can remove specific version', function(done){
    async.eachSeries(initialModules, function(module, cb){
      moduleSvc.removeVersion(module.family, module.name, module.version, function(err){
        should.not.exists(err);

        moduleSvc.getModuleWithVersion(module.family, module.name, module.version, function(err, moduleWithVersion){
          should.not.exists(err);
          if (moduleWithVersion) {
            should(moduleWithVersion).is.Object;
            should.not.exists(moduleWithVersion.version);
          }

          cb();
        });
      });
    }, done);
  });

  it('can remove module with all versions', function(done){
    async.eachSeries(initialModules, function(module, cb){
      moduleSvc.removeModule(module.family, module.name, function(err){
        should.not.exists(err);

        moduleSvc.getModule(module.family, module.name, function(err, module){
          should.not.exists(err);
          should.not.exists(module);

          cb();
        });
      });
    }, done);
  });

  it('can update module', function(done){
    async.waterfall([
      moduleSvc.modules,
      function(modules, callback) {
        async.each(modules, function(module, cb){
          var newFamily = util.randomString(),
              newName = util.randomString();

          moduleSvc.updateModule({
            family: newFamily,
            name: newName,
            id: module.id
          }, function(err){
            should.not.exists(err);

            moduleSvc.getModule(newFamily, newName, function(err, m){
              should.not.exists(err);
              should(m.id).eql(module.id);

              cb();
            })
          })
        }, callback);
      }
    ], done);
  });*/

});
