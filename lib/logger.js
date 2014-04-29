var winston = require('winston');
var _ = require('lodash');
var settings = require('./settings');

var loggerOption = {
  level: settings.logLevel,
  handleExceptions: true,
  colorize: true
};

var transports = [new winston.transports.Console(loggerOption)];
if (settings.logFile) {
  transports.push(
    new winston.transports.File(_.merge({
      filename: settings.logFile,
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
