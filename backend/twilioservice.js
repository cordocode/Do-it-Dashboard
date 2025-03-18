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

  // Initialize OpenAI service
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

        // Send the SMS with a friendlier message
        await twilioClient.messages.create({
          body: `Hey! Your code is ${code}. Enter this code to connect your phone! 📱✨`,
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

        // Check DB for user's stored verification code
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

          // Send welcome message via Twilio after successful verification
          try {
            await twilioClient.messages.create({
              body: "Phone verified! Text this number to manage your tasks on the go. Add me to your contacts, then simply message in natural language to add, remove, or update tasks whenever you need to.",
              from: twilioNumber,
              to: normalizedPhone,
            });
          } catch (smsError) {
            console.error('Error sending welcome SMS:', smsError);
            // Continue with success response even if welcome SMS fails
          }

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
    //  3) Twilio webhook for incoming SMS - UPDATED IMPLEMENTATION
    // ------------------------------------------------------
    app.post('/twilio/webhook', async (req, res) => {
      // Twilio sends these fields in the POST
      const userMessage = req.body.Body;  // user's text
      const fromNumber = req.body.From;   // e.g. +13035551234

      try {
        // Process the SMS using the enhanced OpenAI service
        const result = await openAIService.processSmsMessage(userMessage, fromNumber);
        
        // Generate TwiML response
        const twimlResponse = `<Response><Message>${result.responseText}</Message></Response>`;
        res.send(twimlResponse);
      } catch (err) {
        console.error('Error in /twilio/webhook:', err);
        res.send(`<Response><Message>Oops! 😅 I hit a snag processing your message. Could you try again in a moment?</Message></Response>`);
      }
    });

    // ------------------------------------------------------
    //  4) Testing route for SMS processing without Twilio
    // ------------------------------------------------------
    app.post('/api/test-sms-processing', async (req, res) => {
      const { message, phoneNumber } = req.body;
      
      if (!message || !phoneNumber) {
        return res.status(400).json({ 
          success: false, 
          error: 'Both message and phoneNumber are required' 
        });
      }

      try {
        // Process the SMS using OpenAI service
        const result = await openAIService.processSmsMessage(message, phoneNumber);
        res.json(result);
      } catch (err) {
        console.error('Error in test-sms-processing:', err);
        res.status(500).json({ 
          success: false, 
          error: err.message 
        });
      }
    });
  }

  return { routes };
}

// Export the factory function
module.exports = setupTwilioService;