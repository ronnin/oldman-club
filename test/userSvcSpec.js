/*global describe, it, beforeEach, afterEach*/
var should = require('should');
var async = require('async');

var util = require('../lib/util');

var env = require('./env');

// ! Test Target !
var userSvc = require('../services/userSvc');

describe('userSvc', function(){
  var initialUsers = [
    {
      username: 'james', password: 'secure', active: false,
      _update: { password: 'simple', active: true }
    },
    {
      username: 'bob',   password: 'secure', admin: true,
      _update: { admin: false }
    },
    {
      username: 'jack',  password: 'secure', admin: true,
      _update: { active: false }
    },
    {
      username: 'john',  password: 'secure',
      _update: { password: 'classified', admin: true }
    }
  ];

  before(env.init);

  beforeEach(function(done){
    async.series([
      userSvc.clear,
      async.eachSeries.bind(null, initialUsers, userSvc.create)
    ], done);
  });

  it('can fetch all users', function(done){
    userSvc.all(function(err, users){
      should.not.exists(err);
      should(users).be.an.Array;
      should(users.length).eql(initialUsers.length);
      done();
    });
  });

  it('can fetch conditional users(admin)', function(done) {
    async.each([null, true, false], function(active, cb) {
      userSvc.admins(active, function(err, users) {
        should.not.exists(err);
        should(users).be.an.Array;

        var expected = [];
        initialUsers.forEach(function(user){
          if (user.admin && (active === null || (user.active !== false) == active)) {
            expected.push(user.username);
          }
        });
        should(users.length).eql(expected.length);
        should(users.map(function(user){
          return user.username;
        }).sort()).eql(expected.sort());

        cb();
      });
    }, done);
  });

  it('can fetch conditional users(active)', function(done) {
    userSvc.actives(function(err, users) {
      should.not.exists(err);
      should(users).be.an.Array;

      var expected = [];
      initialUsers.forEach(function(user){
        if (user.active !== false) {
          expected.push(user.username);
        }
      });
      should(users.length).eql(expected.length);
      should(users.map(function(user){
        return user.username;
      }).sort()).eql(expected.sort());

      done();
    });
  });

  it('can fetch user by username', function(done){
    async.each(initialUsers, function(user, cb){
      userSvc.getByName(user.username, function(err, rec){
        should.not.exists(err);
        should(rec).be.an.Object;
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
        should(user).be.an.Object;
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
        userSvc.getByName(user.username, function(err, updated){
          should.not.exists(err);
          should(updated).be.an.Object;
          if (util.isPresent(up.password)) {
            should(updated.password).equal(util.sha1Sum(up.password));
          }
          if (util.isPresent(up.admin)) {
            should(updated.admin).equal(up.admin);
          }
          if (util.isPresent(up.active)) {
            should(updated.active).equal(up.active);
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
      userSvc.login(user.username, user.password, function(err, auth){
        if (user.active === false) {
          should(err).be.ok;
          cb();
        } else {
          should.not.exists(err);
          should(auth).have.properties('token', 'tokenExpire');
          should(auth.token).be.ok;
          userSvc.latestAuth(user.username, true, function(err, authFetched){
            should.not.exists(err);
            should(authFetched).be.an.Object;
            should(authFetched.values).eql(auth.values);
            cb();
          });
        }
      });
    }, done);
  });

  it('can login as admin', function(done){
    async.each(initialUsers, function(user, cb){
      userSvc.login(user.username, user.password, true, function(err, auth){
        if (user.active === false || !user.admin) {
          should(err).be.ok;
          cb();
        } else {
          should.not.exists(err);
          should(auth).have.properties('token', 'tokenExpire');
          should(auth.token).be.ok;
          userSvc.latestAuth(user.username, function(err, authFetched){
            should.not.exists(err);
            should(authFetched).be.an.Object;
            should(authFetched.values).eql(auth.values);
            cb();
          });
        }
      });
    }, done);
  });

  it('can auth with token (gotten at last success auth)', function(){

  });

  it('can auth by OAuth', function(){

  });
});