// twilioservice.js - For both backend and local-backend
const express = require('express');
const cors = require('cors');
require('dotenv').config();
require('dotenv').config({ path: '.env.development' });

const twilio = require('twilio');
const setupOpenAIService = require('./openAIservice');

function setupTwilioService(pool) {
  const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const twilioNumber = process.env.TWILIO_NUMBER;
  
  // Initialize OpenAI service
  const openAIService = setupOpenAIService();

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

    require('dotenv').config(); // If you use a local .env file for dev
const express = require('express');
const cors = require('cors');
const twilio = require('twilio');

const app = express();
app.use(cors());
app.use(express.json());

// 1) Pull in Twilio environment variables from EB
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken  = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_NUMBER;

// 2) Create a Twilio client
const twilioClient = twilio(accountSid, authToken);

// 3) Example route: Send verification code
app.post('/api/send-verification-code', async (req, res) => {
  try {
    const { userId, phoneNumber } = req.body;

    // Generate a random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000);

    // TODO: Store that code in your DB for this user (Postgres, etc.)
    // Example: await pool.query('UPDATE users SET verification_code = $1 WHERE user_id = $2', [code, userId]);

    // Send the SMS
    await twilioClient.messages.create({
      body: `Your verification code is ${code}`,
      from: twilioNumber,    // e.g. +1234567890
      to: phoneNumber        // e.g. +13035551234
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error sending verification code:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4) Example route: Verify the code
app.post('/api/verify-phone', async (req, res) => {
  try {
    const { userId, code, phoneNumber } = req.body;

    // Get the stored code from DB
    // Example:
    //   const { rows } = await pool.query('SELECT verification_code FROM users WHERE user_id = $1', [userId]);
    //   if (!rows.length) return res.status(404).json({ success: false, error: 'User not found' });
    //   const storedCode = rows[0].verification_code;

    // Compare the codes
    //   if (storedCode == code) {
    //     // Mark phone as verified in DB
    //     await pool.query('UPDATE users SET phone_verified = TRUE, phone_number = $1 WHERE user_id = $2', [phoneNumber, userId]);
    //     res.json({ success: true });
    //   } else {
    //     res.status(400).json({ success: false, error: 'Incorrect verification code' });
    //   }

    // For now, let's just pretend success
    res.json({ success: true });
  } catch (err) {
    console.error('Error verifying phone:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5) Example route for user profile
app.get('/api/user-profile', async (req, res) => {
  try {
    const { userId } = req.query;

    // e.g. let result = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    // if (!result.rows.length) return res.json({ success: false, error: 'User not found' });
    // const user = result.rows[0];

    // Return a shape like:
    const userProfile = {
      first_name: 'Jimmy',
      phone_number: '+13035551234',
      phone_verified: true,
    };
    res.json({ success: true, profile: userProfile });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6) Example route for updating user profile
app.put('/api/user-profile', async (req, res) => {
  try {
    const { userId, firstName } = req.body;
    // e.g. await pool.query('UPDATE users SET first_name = $1 WHERE user_id = $2', [firstName, userId]);

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7) Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
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
      const userMessage = req.body.Body;
      const fromNumber = req.body.From;
      
      // Use normalized phone number to match DB format
      const normalizedNumber = fromNumber.replace(/\s/g, '');

      try {
        // Identify user
        const userResult = await pool.query(
          'SELECT * FROM users WHERE phone_number = $1 AND phone_verified = TRUE',
          [normalizedNumber]
        );
        const user = userResult.rows[0];

        if (!user) {
          res.send('<Response><Message>Your number is not linked to an account.</Message></Response>');
          return;
        }

        // Process with OpenAI to understand intent
        const intentData = await openAIService.analyzeMessageIntent(userMessage);
        let responseText = '';

        // Take action based on intent
        switch (intentData.intent) {
          case 'add_task':
            if (intentData.task_content) {
              // Add the task to the database
              await pool.query(
                'INSERT INTO boxes (user_id, content) VALUES ($1, $2)',
                [user.user_id, intentData.task_content]
              );
              responseText = `Added task: ${intentData.task_content}`;
            } else {
              responseText = "I couldn't determine what task to add. Please try again with more details.";
            }
            break;
            
          case 'remove_task':
            if (intentData.task_identifier) {
              // First get all the user's tasks
              const tasksResult = await pool.query(
                'SELECT * FROM boxes WHERE user_id = $1 ORDER BY id ASC',
                [user.user_id]
              );
              
              // Try to identify which task to remove
              const taskIndex = parseInt(intentData.task_identifier) - 1;
              let taskToRemove = null;

              if (!isNaN(taskIndex) && taskIndex >= 0 && taskIndex < tasksResult.rows.length) {
                // User specified a task by number
                taskToRemove = tasksResult.rows[taskIndex];
              } else {
                // Try to match by content
                taskToRemove = tasksResult.rows.find(task => 
                  task.content.toLowerCase().includes(intentData.task_identifier.toLowerCase())
                );
              }

              if (taskToRemove) {
                await pool.query('DELETE FROM boxes WHERE id = $1', [taskToRemove.id]);
                responseText = `Removed task: ${taskToRemove.content}`;
              } else {
                responseText = `I couldn't find a task matching "${intentData.task_identifier}". Please try again.`;
              }
            } else {
              responseText = "I couldn't determine which task to remove. Please specify by number or description.";
            }
            break;
            
          case 'list_tasks':
            const listResult = await pool.query(
              'SELECT * FROM boxes WHERE user_id = $1 ORDER BY id ASC',
              [user.user_id]
            );
            
            if (listResult.rows.length > 0) {
              responseText = "Your tasks:\n" + 
                listResult.rows.map((task, index) => `${index + 1}. ${task.content}`).join("\n");
            } else {
              responseText = "You don't have any tasks yet.";
            }
            break;
            
          default:
            // Generate a friendly response via OpenAI for unrecognized commands
            responseText = await openAIService.generateUserResponse(intentData);
        }

        // Send the response back to the user
        res.send(`<Response><Message>${responseText}</Message></Response>`);
      } catch (err) {
        console.error('Error in /twilio/webhook:', err);
        res.send('<Response><Message>An error occurred. Please try again later.</Message></Response>');
      }
    });
  };

  return { routes };
}

module.exports = setupTwilioService;