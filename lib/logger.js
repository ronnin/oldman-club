var winston = require('winston');
var _ = require('lodash');
var conf = require('../conf');

var loggerOption = {
  level: conf.log.level,
  handleExceptions: true,
  colorize: true
};

var transports = [new winston.transports.Console(loggerOption)];
if (conf.log.file) {
  transports.push(
    new winston.transports.File(_.merge({
      filename: conf.log.file,
      maxsize: 50*1024*1024,
      maxFiles: 14
    }, loggerOption))
  );
}

module.exports = new winston.Logger({
  transports: transports,
  exitOnError: function ignoreEPIPE(err) {
    return err.code !== 'EPIPE';
  }
});
