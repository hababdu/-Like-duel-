// src/utils/logger.js
const LOG_LEVELS = {
    ERROR: 'error',
    WARN: 'warn',
    INFO: 'info',
    DEBUG: 'debug'
  };
  
  class Logger {
    constructor() {
      this.level = process.env.LOG_LEVEL || LOG_LEVELS.INFO;
    }
  
    shouldLog(level) {
      const levels = Object.values(LOG_LEVELS);
      return levels.indexOf(level) <= levels.indexOf(this.level);
    }
  
    log(level, message, ...args) {
      if (!this.shouldLog(level)) return;
  
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
      
      if (args.length > 0) {
        console.log(prefix, message, ...args);
      } else {
        console.log(prefix, message);
      }
    }
  
    error(message, ...args) {
      this.log(LOG_LEVELS.ERROR, message, ...args);
    }
  
    warn(message, ...args) {
      this.log(LOG_LEVELS.WARN, message, ...args);
    }
  
    info(message, ...args) {
      this.log(LOG_LEVELS.INFO, message, ...args);
    }
  
    debug(message, ...args) {
      this.log(LOG_LEVELS.DEBUG, message, ...args);
    }
  }
  
  export default new Logger();