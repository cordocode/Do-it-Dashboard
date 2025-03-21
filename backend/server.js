/***********************************
 * server.js — Full, combined code
 ***********************************/
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { Pool } = require('pg');

/** Decide whether to use SSL in production. */
function getSSLConfig() {
  if (process.env.NODE_ENV === 'development') {
    // local dev typically doesn't use SSL
    return false;
  } else {
    // on AWS, often need to allow self-signed
    return { rejectUnauthorized: false };
  }
}

/** Create your Postgres connection pool. */
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: getSSLConfig(),
});

/** Initialize Express. */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ===============================================
   1) GET user profile — create user if needed
=============================================== */
app.get('/api/user-profile', async (req, res) => {
  try {
    // We now read both userId and email from query params
    const { userId, email } = req.query;

    // Check if user already exists
    let userResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );

    // If not found => create a new row with user_id and email
    if (userResult.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (user_id, email) VALUES ($1, $2)',
        [userId, email]
      );
      // Re-fetch the newly created user
      userResult = await pool.query(
        'SELECT * FROM users WHERE user_id = $1',
        [userId]
      );
    }

    const profile = userResult.rows[0];
    res.json({
      success: true,
      profile: {
        first_name: profile.first_name,
        email: profile.email,
        phone_number: profile.phone_number,
        phone_verified: profile.phone_verified
      }
    });
  } catch (err) {
    console.error('Error in GET /api/user-profile:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ===============================================
   2) PUT update user's first_name and time_zone
=============================================== */
app.put('/api/user-profile', async (req, res) => {
  try {
    const { userId, firstName, timeZone } = req.body;

    // Build dynamic query depending on provided fields
    let updateQuery = 'UPDATE users SET ';
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (firstName) {
      updateFields.push(`first_name = $${paramIndex++}`);
      updateValues.push(firstName);
    }

    if (timeZone) {
      updateFields.push(`time_zone = $${paramIndex++}`);
      updateValues.push(timeZone);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields provided to update.' });
    }

    updateQuery += updateFields.join(', ') + ` WHERE user_id = $${paramIndex} RETURNING *`;
    updateValues.push(userId);

    const result = await pool.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found.' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ===============================================
   3) GET user by phone
=============================================== */
app.get('/api/user-by-phone', async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE phone_number = $1 AND phone_verified = TRUE',
      [phone]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Error in GET /api/user-by-phone:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ===============================================
   4) DB test route
=============================================== */
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({ success: true, time: result.rows[0].current_time });
  } catch (error) {
    console.error('DB test error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ===============================================
   5) Boxes CRUD
=============================================== */

// CREATE a new box
const chrono = require('chrono-node');
const { DateTime } = require('luxon');

app.post('/api/boxes', async (req, res) => {
  try {
    const { userId, content, time_type, time_value, reminder_offset } = req.body;

    const userResult = await pool.query('SELECT time_zone FROM users WHERE user_id = $1', [userId]);
    const userTimeZone = userResult.rows[0]?.time_zone || 'UTC';
    console.log('User timezone:', userTimeZone);

    let parsedTimestamp = null;

    if (time_value && time_value !== 'none') {
      // First check if time_value is already a valid ISO string
      const isISODate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(time_value);
      
      if (isISODate) {
        // It's already formatted as ISO, just ensure it's in UTC
        parsedTimestamp = DateTime.fromISO(time_value).toUTC().toISO();
        console.log('Already ISO format - converted to UTC:', parsedTimestamp);
      } else {
        // Parse natural language time
        const nowInUserTZ = DateTime.now().setZone(userTimeZone);
        console.log('Now in User Timezone:', nowInUserTZ.toString());

        // CRITICAL FIX: If the time includes "tonight" but doesn't specify AM/PM,
        // and the hour is between 1-11, assume PM
        let timeString = time_value;
        if (/tonight at \d{1,2}(:00)?$/.test(time_value)) {
          const hourMatch = time_value.match(/\d{1,2}/);
          if (hourMatch && parseInt(hourMatch[0]) < 12) {
            timeString = time_value.replace(/at (\d{1,2})/, 'at $1pm');
            console.log('Assuming PM for evening time:', timeString);
          }
        }

        const parsedResults = chrono.parse(timeString, nowInUserTZ.toJSDate(), { forwardDate: true });
        console.log('Chrono-node parsed results:', parsedResults);

        if (parsedResults.length > 0) {
          const userLocalDate = parsedResults[0].start.date();
          console.log('Chrono-node userLocalDate:', userLocalDate);

          // FIXED: The userLocalDate is already in UTC format
          // Just store it directly without additional timezone conversion
          parsedTimestamp = userLocalDate.toISOString();
          console.log('Parsed Timestamp stored in DB (UTC):', parsedTimestamp);
        } else {
          throw new Error(`Failed to parse: "${time_value}"`);
        }
      }
    }

    const result = await pool.query(
      `INSERT INTO boxes (user_id, content, time_type, time_value, reminder_offset)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, content, time_type || 'none', parsedTimestamp, reminder_offset || 0]
    );

    res.json({ success: true, box: result.rows[0] });
  } catch (err) {
    console.error('Error creating box:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// READ boxes by userId
app.get('/api/boxes', async (req, res) => {
  try {
    const { userId } = req.query;
    const result = await pool.query(
      'SELECT * FROM boxes WHERE user_id = $1 ORDER BY id ASC',
      [userId]
    );
    res.json({ success: true, boxes: result.rows });
  } catch (err) {
    console.error('Error reading boxes:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE a specific box by ID
app.delete('/api/boxes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM boxes WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting box:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// UPDATE a box's content
app.put('/api/boxes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, time_type, time_value, reminder_offset, userId } = req.body;
    
    // Process time_value if provided and not 'none'
    let parsedTimestamp = time_value;
    
    if (time_value && time_value !== 'none' && userId) {
      // Check if it's already in ISO format
      const isISODate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(time_value);
      
      if (!isISODate) {
        // Get user's timezone for natural language parsing
        const userResult = await pool.query('SELECT time_zone FROM users WHERE user_id = $1', [userId]);
        const userTimeZone = userResult.rows[0]?.time_zone || 'UTC';
        
        // Parse natural language using user's timezone as reference
        const nowInUserTZ = DateTime.now().setZone(userTimeZone);
        
        // CRITICAL FIX: If the time includes "tonight" but doesn't specify AM/PM,
        // and the hour is between 1-11, assume PMlet timeString = time_value;
        if (/tonight at \d{1,2}(:00)?$/.test(time_value)) {
          const hourMatch = time_value.match(/\d{1,2}/);
          if (hourMatch && parseInt(hourMatch[0]) < 12) {
            timeString = time_value.replace(/at (\d{1,2})/, 'at $1pm');
            console.log('Assuming PM for evening time:', timeString);
          }
        }
        
        const parsedResults = chrono.parse(timeString, nowInUserTZ.toJSDate(), { forwardDate: true });
        
        if (parsedResults.length > 0) {
          const userLocalDate = parsedResults[0].start.date();
          
          // FIXED: The userLocalDate is already in UTC format
          // Just store it directly without additional timezone conversion
          parsedTimestamp = userLocalDate.toISOString();
        }
      }
    }
    console.log('FINAL DB INSERT - timestamp value:', parsedTimestamp);
    const result = await pool.query(
      `UPDATE boxes
       SET content = $1,
           time_type = $2,
           time_value = $3,
           reminder_offset = $4
       WHERE id = $5 RETURNING *`,
      [content, time_type || 'none', parsedTimestamp, reminder_offset, id]
    );
    console.log('RETURNED FROM DB:', result.rows[0].time_value);
    
    res.json({ success: true, box: result.rows[0] });
  } catch (err) {
    console.error('Error updating box:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ===============================================
   6) Twilio routes from twilioservice.js
=============================================== */
const setupTwilioService = require('./twilioservice');
const twilioService = setupTwilioService(pool);
// This call attaches the Twilio endpoints (/api/send-verification-code, etc.) to `app`.
twilioService.routes(app);

/* ===============================================
   7) A simple root route
=============================================== */
app.get('/', (req, res) => {
  res.send('Server is running!');
});

/* ===============================================
   8) Start Reminder Scheduler
=============================================== */
require('./reminder_scheduler');

/* ===============================================
   9) Finally, start the server
=============================================== */
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});