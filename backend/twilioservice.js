// twilioservice.js - Combined version with no duplicate app definitions
require('dotenv').config();
require('dotenv').config({ path: '.env.development' });

const express = require('express');
const cors = require('cors');
const twilio = require('twilio');
const setupOpenAIService = require('./openAIservice');

/**
 * Sets up Twilio & optional OpenAI routes on an existing Express app.
 * 
 * @param {Pool} pool - Your pg Pool instance (Postgres)
 * @return {Object}   - An object with `.routes(app)` to attach Twilio endpoints
 */
function setupTwilioService(pool) {
  // Initialize Twilio
  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID, 
    process.env.TWILIO_AUTH_TOKEN
  );
  const twilioNumber = process.env.TWILIO_NUMBER;

  // If you use OpenAI to parse incoming SMS commands
  const openAIService = setupOpenAIService();

  // Helper to generate random 6-digit codes
  function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  // Normalize phone to E.164, e.g. +13035551234
  function normalizePhoneNumber(rawPhone) {
    const digits = rawPhone.replace(/\D/g, '');
    if (!digits.startsWith('1')) {
      // prepend a '1' if missing
      return '+' + '1' + digits;
    }
    return '+' + digits;
  }

  /**
   * Attaches all Twilio-related routes to `app`.
   * Call this from server.js like:
   *    const twilioService = setupTwilioService(pool);
   *    twilioService.routes(app);
   */
  function routes(app) {
    // For convenience (not strictly required):
    app.use(cors());
    app.use(express.json());

    // ------------------------------------------------------
    //  1) Send verification code via Twilio SMS
    // ------------------------------------------------------
    app.post('/api/send-verification-code', async (req, res) => {
      const { userId, phoneNumber } = req.body;
      const code = generateVerificationCode();

      try {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);

        // Store code in the DB:
        await pool.query(
          'UPDATE users SET verification_code = $1 WHERE user_id = $2',
          [code, userId]
        );

        // Send the SMS
        await twilioClient.messages.create({
          body: `Your verification code is ${code}`,
          from: twilioNumber,
          to: normalizedPhone,
        });

        res.json({ success: true });
      } catch (err) {
        console.error('Error in send-verification-code:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // ------------------------------------------------------
    //  2) Verify phone with submitted code
    // ------------------------------------------------------
    app.post('/api/verify-phone', async (req, res) => {
      const { userId, code, phoneNumber } = req.body;
      try {
        const normalizedPhone = normalizePhoneNumber(phoneNumber);

        // Check DB for user’s stored verification code
        const result = await pool.query(
          'SELECT verification_code FROM users WHERE user_id = $1',
          [userId]
        );
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        const storedCode = result.rows[0].verification_code;
        if (String(storedCode) === String(code)) {
          // Code matches => mark phone verified
          await pool.query(
            `UPDATE users
             SET phone_verified = TRUE,
                 phone_number   = $1,
                 verification_code = NULL
             WHERE user_id = $2`,
            [normalizedPhone, userId]
          );
          res.json({ success: true });
        } else {
          res.status(400).json({ success: false, error: 'Incorrect verification code.' });
        }
      } catch (err) {
        console.error('Error in verify-phone:', err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // ------------------------------------------------------
    //  3) (Optional) Twilio webhook for incoming SMS
    // ------------------------------------------------------
    app.post('/twilio/webhook', async (req, res) => {
      // Twilio sends these fields in the POST
      const userMessage = req.body.Body;  // user’s text
      const fromNumber = req.body.From;   // e.g. +13035551234

      // E.g. remove spaces or do further normalization
      const normalizedNumber = fromNumber.replace(/\s+/g, '');

      try {
        // Identify the user by phone
        const userResult = await pool.query(
          'SELECT * FROM users WHERE phone_number = $1 AND phone_verified = TRUE',
          [normalizedNumber]
        );
        const user = userResult.rows[0];
        if (!user) {
          // Not found => return TwiML
          return res.send(
            `<Response><Message>Your number is not linked to any verified account.</Message></Response>`
          );
        }

        // If you use OpenAI to interpret commands
        const intentData = await openAIService.analyzeMessageIntent(userMessage);
        let responseText = '';

        switch (intentData.intent) {
          case 'add_task': {
            if (intentData.task_content) {
              // Insert a row into boxes
              await pool.query(
                'INSERT INTO boxes (user_id, content) VALUES ($1, $2)',
                [user.user_id, intentData.task_content]
              );
              responseText = `Added task: "${intentData.task_content}"`;
            } else {
              responseText = `I couldn't figure out what task to add. Try: "Add buy groceries"`;
            }
            break;
          }
          case 'remove_task': {
            // You can do logic to remove a user’s box
            // ...
            responseText = `Remove logic not shown here. :)
Try: "Remove task #2" for an example.`;
            break;
          }
          case 'list_tasks': {
            // Retrieve that user’s boxes, etc.
            // ...
            responseText = `List tasks logic not shown here. :)`;
            break;
          }
          default:
            // If it’s an unrecognized command => maybe let OpenAI handle it
            responseText = await openAIService.generateUserResponse(intentData);
            break;
        }

        // Return TwiML so Twilio can deliver it back to the user
        res.send(`<Response><Message>${responseText}</Message></Response>`);
      } catch (err) {
        console.error('Error in /twilio/webhook:', err);
        res.send(`<Response><Message>Something went wrong. Please try again later.</Message></Response>`);
      }
    });
  }

  return { routes };
}

// Export the factory function
module.exports = setupTwilioService;
