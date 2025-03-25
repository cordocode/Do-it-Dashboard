/***********************************
 * setup.js — Full, combined code
 ***********************************/
// setup.js help with edge case architechtural implementations

//punycode waring suppressor
function suppressPunycodeWarning() {
    process.emitWarning = (function () {
      const originalEmitWarning = process.emitWarning;
      return function (warning, type, code, ...args) {
        if (code === 'DEP0040') return;
        return originalEmitWarning.call(process, warning, type, code, ...args);
      };
    })();
  }
  
// Decide whether to use SSL in production.
function getSSLConfig() {
    if (process.env.NODE_ENV === 'development') {
      // local dev typically doesn't use SSL
      return false;
    } else {
      // Live server uses SSL
      return { rejectUnauthorized: false };
    }
  }

// Force UTC timezone for all Node operations
function setGlobalUTCTimezone() {
    process.env.TZ = 'UTC';
}

// Setup function to ensure database connections use UTC
function setupDatabaseTimezone(pool) {
    pool.on('connect', async (client) => {
        await client.query('SET timezone = "UTC"');
    });
}

//Elastic Beanstalk required health check
function healthCheck(app) {
app.get('/', (req, res) => {
    res.send('Server is running');
  });
}

// Export the functions
module.exports = { 
    suppressPunycodeWarning, 
    getSSLConfig,
    setGlobalUTCTimezone,
    setupDatabaseTimezone,
    healthCheck,
};