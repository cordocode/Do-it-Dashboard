/***********************************
 * logger.js — Full, combined code
 ***********************************/

// logger.js - Structured logging for debugging task scheduling workflow called in other documents via the function logStep 
function logStep(stepDescription, data) {
    console.log(`\n=== ${stepDescription} ===`);
    if (typeof data === 'object') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
    console.log(`=== End of ${stepDescription} ===\n`);
  }
  
  module.exports = { logStep };
  