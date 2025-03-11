const { createLogger, format, transports } = require('winston');
const fs = require('fs');
const DailyRotate = require('winston-daily-rotate-file');

const logDir = 'logs';

let infoLogger;
let errorLogger;
let warnLogger;
let allLogger;

function getCallerFileName() {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  let callerFileName;

  try {
    Error.prepareStackTrace = function (err, stack) {
      callerFileName = stack[1].getFileName();
    };

    const error = new Error();
    Error.captureStackTrace(error, getCallerFileName);
    error.stack;
  } catch (err) {
    console.error('Error:', err);
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }

  return callerFileName;
}

class Logger {
  constructor() {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir);
    }

    infoLogger = createLogger({
      level: process.env.NODE_ENV === 'development' ? 'info' : 'debug',
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          (info) => `${info.timestamp} ${info.level}: ${info.message}`
        )
      ),
      transports: [
        new transports.Console({
          levels: 'info',
          format: format.combine(
            format.colorize(),
            format.printf(
              (info) => `${info.timestamp} ${info.level}: ${info.message}`
            )
          ),
        }),

        new DailyRotate({
          filename: `${logDir}/%DATE%/info.log`,
          datePattern: 'DD-MM-YYYY',
        }),
      ],
      exitOnError: false,
    });

    errorLogger = createLogger({
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          (error) => `${error.timestamp} ${error.level}: ${error.message}`
        )
      ),
      transports: [
        new transports.Console({
          levels: 'error',
          format: format.combine(
            format.colorize(),
            format.printf(
              (error) => `${error.timestamp} ${error.level}: ${error.message}`
            )
          ),
        }),

        new DailyRotate({
          filename: `${logDir}/%DATE%/errors.log`,
          datePattern: 'DD-MM-YYYY',
        }),
      ],
      exitOnError: false,
    });

    warnLogger = createLogger({
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          (warn) => `${warn.timestamp} ${warn.level}: ${warn.message}`
        )
      ),
      transports: [
        new transports.Console({
          levels: 'warn',
          format: format.combine(
            format.colorize(),
            format.printf(
              (warn) => `${warn.timestamp} ${warn.level}: ${warn.message}`
            )
          ),
        }),

        new DailyRotate({
          filename: `${logDir}/%DATE%/warnings.log`,
          datePattern: 'DD-MM-YYYY',
        }),
      ],
      exitOnError: false,
    });

    allLogger = createLogger({
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.printf(
          (silly) => `${silly.timestamp} ${silly.level}: ${silly.message}`
        )
      ),
      transports: [
        new DailyRotate({
          filename: `${logDir}/%DATE%/results.log`,
          datePattern: 'DD-MM-YYYY',
        }),
      ],
      exitOnError: false,
    });
  }

  log(message, severity, data) {
    message = `--- ${getCallerFileName()} --- ${message}`;

    if (severity === 'error') {
      errorLogger.log(severity, message);
      allLogger.log(severity, message, data);
    } else if (severity === 'warn') {
      warnLogger.log(severity, message, data);
      allLogger.log(severity, message, data);
    } else {
      infoLogger.log(severity || 'info', message, data);
      allLogger.log(severity || 'info', message, data);
    }
  }
}

module.exports = Logger;
