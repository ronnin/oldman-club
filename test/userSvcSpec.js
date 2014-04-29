/*global describe, it, beforeEach, afterEach*/
var should = require('should');
var async = require('async');
// ! Test Target !
var userSvc = require('../services/userSvc');
var util = require('../lib/util');

describe('userSvc', function(){
  var initialUsers = [
    {
      username: 'james', password: 'secure', active: false,
      _update: {
        password: 'simple',
        active: true
      }
    },
    {
      username: 'bob',   password: 'secure', admin: true,
      _update: {
        admin: false
      }
    },
    {
      username: 'jack',  password: 'secure', admin: true,
      _update: {
        active: false
      }
    },
    {
      username: 'john',  password: 'secure',
      _update: {
        password: 'classified',
        admin: true
      }
    }
  ];

  beforeEach(function(done){
    async.series([
      userSvc.clear,
      function(cb) {
        async.eachSeries(initialUsers, userSvc.create, cb);
      }
    ], done);
  });

  it('can fetch all users', function(done){
    userSvc.all(function(err, users){
      should.not.exists(err);
      should(users).is.an.Array;
      should(users.length).be.above(initialUsers.length - 1);
      done();
    });
  });

  it('can fetch conditional users(admin)', function(done) {
    async.each([null, true, false], function(active, cb) {
      userSvc.admins(active, function(err, users) {
        should.not.exists(err);
        should(users).is.an.Array;

        var expectedCount = initialUsers.filter(function(user){
          return user.admin && (active === null || user.active == active);
        }).length;
        should(users.length).be.above(expectedCount - 1);

        cb();
      });
    }, done);
  });

  it('can fetch conditional users(active)', function(done) {
    userSvc.actives(function(err, users) {
      should.not.exists(err);
      should(users).is.an.Array;

      var expectedCount = initialUsers.filter(function(user){
        return user.active;
      }).length;
      should(users.length).be.above(expectedCount - 1);

      done();
    });
  });

  it('can fetch user by username', function(done){
    async.each(initialUsers, function(user, cb){
      userSvc.getByName(user.username, function(err, rec){
        should.not.exists(err);
        should(rec).is.an.Object;
        should(rec.username).eql(user.username);
        cb();
      });
    }, done);
  });

  it('can create new user', function(done){
    userSvc.create({
      username: 'ronnin',
      password: 's3cret'
    }, function(err){
      should.not.exists(err);
      userSvc.getByName('ronnin', function(err, user) {
        should.not.exists(err);
        should(user).is.an.Object;
        should(user.username).eql('ronnin');

        done();
      });
    });
  });

  it('can update user', function(done){
    async.each(initialUsers, function(user, cb){
      var up = user._update;
      if (!up) return cb();
      up.username = user.username;

      userSvc.update(up, function(err){
        should.not.exists(err);
        userSvc.getByName(user.username, function(err, user){
          should.not.exists(err);
          should(user).is.an.Object;
          if (util.isPresent(up.password)) {
            should(user.password).equal(util.sha1Sum(up.password));
          }
          if (util.isPresent(up.admin)) {
            should(user.admin).equal(util.bool2int(up.admin));
          }
          if (util.isPresent(up.active)) {
            should(user.active).equal(util.bool2int(up.active));
          }

          cb();
        })
      });
    }, done);
  });

  it('can remove user by username', function(done){
    async.each(initialUsers, function(user, cb){
      userSvc.removeByName(user.username, function(err){
        should.not.exists(err);

        userSvc.getByName(user.username, function(err, row){
          should.not.exists(err);
          should.not.exists(row);

          cb();
        });
      });
    }, done);
  });

  it('can login', function(done){
    async.each(initialUsers, function(user, cb){
      userSvc.login(user.username, user.password, function(err){
        if (user.active === false) {
          should(err).be.ok;
          cb();
        } else {
          should.not.exists(err);
          userSvc.loginInfo(user.username, function(err, row){
            should.not.exists(err);
            should(row).be.ok.and.is.an.Object;
            should(row.last).be.ok;
            should(Date.parse(row.last)).approximately(Date.now(), 20000); // 20'
            cb();
          });
        }
      });
    }, done);
  });

  it('can login as admin', function(done){
    async.each(initialUsers, function(user, cb){
      userSvc.loginAsAdmin(user.username, user.password, function(err){
        if (user.active === false || !user.admin) {
          should(err).be.ok;
          cb();
        } else {
          should.not.exists(err);
          userSvc.loginInfo(user.username, function(err, row){
            should.not.exists(err);
            should(row).be.ok.and.is.an.Object;
            should(row.last).be.ok;
            should(Date.parse(row.last)).approximately(Date.now(), 20000); // 20'
            cb();
          });
        }
      });
    }, done);
  });
});