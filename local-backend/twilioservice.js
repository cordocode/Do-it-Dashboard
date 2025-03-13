// twilioservice.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('dotenv').config({ path: '.env.development' });

const twilio = require('twilio');

function setupTwilioService(pool) {
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const twilioNumber = process.env.TWILIO_NUMBER;

  // Function to generate a random 6-digit code
  function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  // Simple helper to normalize phone numbers to +1XXXXXXXXXX format
  function normalizePhoneNumber(rawPhone) {
    // Remove all non-digit characters
    let digits = rawPhone.replace(/\D/g, '');
    // If it doesn't start with '1', prepend '1'
    if (!digits.startsWith('1')) {
      digits = '1' + digits;
    }
    // Return with a leading '+'
    return '+' + digits;
  }

  // Routes to be added to Express app
  const routes = (app) => {
    // 1) Send verification code via Twilio SMS
    app.post('/api/send-verification-code', async (req, res) => {
      const { userId, phoneNumber } = req.body;
      const code = generateVerificationCode();

      try {
        // 1a) Normalize phone to E.164 format (e.g., +13039094182)
        const normalizedPhone = normalizePhoneNumber(phoneNumber);

        // 1b) Store code in the DB (not storing phone yet, just the code)
        await pool.query(
          'UPDATE users SET verification_code = $1 WHERE user_id = $2',
          [code, userId]
        );

        // 1c) Send SMS with code
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

    // 2) Verify submitted code
    app.post('/api/verify-phone', async (req, res) => {
      const { userId, code, phoneNumber } = req.body;
      
      try {
        // 2a) Normalize phone so we store the correct format in DB
        const normalizedPhone = normalizePhoneNumber(phoneNumber);

        // 2b) Get stored code from DB
        const result = await pool.query(
          'SELECT verification_code FROM users WHERE user_id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const storedCode = result.rows[0].verification_code;
        
        // 2c) Check if the code matches
        if (storedCode == code) {
          // If it does, update user with verified phone
          await pool.query(
            'UPDATE users SET phone_verified = TRUE, phone_number = $1, verification_code = NULL WHERE user_id = $2',
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

    // 3) Twilio webhook for incoming SMS
    app.post('/twilio/webhook', async (req, res) => {
      // Extract the incoming message and the sender's phone number
      const fromNumber = req.body.From;
      // We can just strip spaces here for matching, or use full normalization if you prefer
      const normalizedNumber = fromNumber.replace(/\s/g, ''); 

      try {
        // Query the database for a verified user with that exact phone_number
        const userResult = await pool.query(
          'SELECT * FROM users WHERE phone_number = $1 AND phone_verified = TRUE',
          [normalizedNumber]
        );
        const user = userResult.rows[0];

        if (!user) {
          // If no user is found, respond indicating the number is not linked
          return res.send('<Response><Message>Your number is not linked to an account.</Message></Response>');
        }

        // Use the user's first_name if available; otherwise, use a generic greeting
        const userName = user.first_name || 'there';
        res.send(`<Response><Message>Hello, ${userName}!</Message></Response>`);
      } catch (err) {
        console.error('Error in /twilio/webhook:', err);
        res.send('<Response><Message>An error occurred. Please try again later.</Message></Response>');
      }
    });
  };

  return { routes };
}

module.exports = setupTwilioService;
