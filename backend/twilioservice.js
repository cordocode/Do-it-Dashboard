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

  // Routes to be added to Express app
  const routes = (app) => {
    // 1) Send verification code via Twilio SMS
    app.post('/api/send-verification-code', async (req, res) => {
      const { userId, phoneNumber } = req.body;
      const code = generateVerificationCode();
      
      try {
        // Store code in database (instead of memory)
        await pool.query(
          'UPDATE users SET verification_code = $1 WHERE user_id = $2',
          [code, userId]
        );

        // Send SMS with code
        await twilioClient.messages.create({
          body: `Your verification code is ${code}`,
          from: twilioNumber,
          to: phoneNumber,
        });

        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // 2) Verify submitted code
    app.post('/api/verify-phone', async (req, res) => {
      const { userId, code, phoneNumber } = req.body;
      
      try {
        // Get stored code from database
        const result = await pool.query(
          'SELECT verification_code FROM users WHERE user_id = $1',
          [userId]
        );
        
        if (result.rows.length === 0) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const storedCode = result.rows[0].verification_code;
        
        if (storedCode == code) {
          // Update user with verified phone
          await pool.query(
            'UPDATE users SET phone_verified = TRUE, phone_number = $1, verification_code = NULL WHERE user_id = $2',
            [phoneNumber, userId]
          );
          res.json({ success: true });
        } else {
          res.status(400).json({ success: false, error: 'Incorrect verification code.' });
        }
      } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // 3) Twilio webhook for incoming SMS
    app.post('/twilio/webhook', async (req, res) => {
      const userMessage = req.body.Body;
      const fromNumber = req.body.From;

      try {
        // Identify user
        const userResult = await pool.query(
          'SELECT * FROM users WHERE phone_number = $1 AND phone_verified = TRUE',
          [fromNumber]
        );
        const user = userResult.rows[0];

        if (!user) {
          res.send('<Response><Message>Your number is not linked to an account.</Message></Response>');
          return;
        }

        // Example interaction: Adding a task via SMS
        if (userMessage.startsWith('ADD TASK')) {
          const taskContent = userMessage.replace('ADD TASK', '').trim();
          await pool.query(
            'INSERT INTO boxes (user_id, content) VALUES ($1, $2)',
            [user.user_id, taskContent]
          );
          res.send(`<Response><Message>Task added: ${taskContent}</Message></Response>`);
        } else {
          res.send('<Response><Message>Command not recognized.</Message></Response>');
        }
      } catch (err) {
        console.error(err);
        res.send('<Response><Message>An error occurred. Please try again later.</Message></Response>');
      }
    });
  };

  return { routes };
}

module.exports = setupTwilioService;