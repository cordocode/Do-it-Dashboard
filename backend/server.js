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

pool.on('connect', async (client) => {
  await client.query('SET timezone = "UTC"');
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

// Simple endpoint that only parses time strings
app.post('/api/parse-time', async (req, res) => {
  try {
    const { timeString, timeZone } = req.body;
    
    if (!timeString) {
      return res.status(400).json({ success: false, error: 'Time string is required' });
    }
    
    const userTimeZone = timeZone || 'UTC';
    const nowInUserTZ = DateTime.now().setZone(userTimeZone);
    
    // Use the same logic from the SMS flow
    let parsedTimestamp = null;
    
    // Handle "at X" expressions for any time phrase
    let processedTimeString = timeString;
    if (/at \d{1,2}(:00)?$/.test(timeString)) {
      const hourMatch = timeString.match(/at (\d{1,2})/);
      if (hourMatch && parseInt(hourMatch[1]) < 7) {
        processedTimeString = timeString.replace(/at (\d{1,2})/, 'at $1pm');
      }
    }
    
    const parsedResults = chrono.parse(processedTimeString, nowInUserTZ.toJSDate(), { forwardDate: true });
    
    if (parsedResults.length > 0) {
      const parsedDate = parsedResults[0].start.date();
      
      // Fix the year if needed
      if (parsedDate.getFullYear() !== nowInUserTZ.year) {
        parsedDate.setFullYear(nowInUserTZ.year);
      }
      
      parsedTimestamp = parsedDate.toISOString();
      
      res.json({
        success: true,
        input: timeString,
        parsed: parsedTimestamp,
        display: new Date(parsedTimestamp).toLocaleString()
      });
    } else {
      res.json({ 
        success: false, 
        error: 'Could not parse time expression' 
      });
    }
  } catch (err) {
    console.error('Error parsing time:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ===============================================
   5) Boxes CRUD
=============================================== */

// CREATE a new box
const chrono = require('chrono-node');
const { DateTime } = require('luxon');

// Test endpoint for time parsing
app.post('/api/test-time-parsing', async (req, res) => {
  try {
    const { timeString, userTimeZone } = req.body;
    
    console.log("TEST - Time parsing request:", { timeString, userTimeZone });
    
    // Use the user's timezone or default to UTC
    const tz = userTimeZone || 'UTC';
    const nowInUserTZ = DateTime.now().setZone(tz);
    
    console.log("TEST - Reference date:", nowInUserTZ.toString());
    
    // 1. Regular chrono-node parsing (what web interface uses)
    const regularResults = chrono.parse(timeString, nowInUserTZ.toJSDate(), { forwardDate: true });
    let regularParsed = null;
    if (regularResults.length > 0) {
      regularParsed = regularResults[0].start.date().toISOString();
    }
    
    // 2. With PM inference for "at X" times (like server.js does for "tonight")
    let timeWithPmInference = timeString;
    if (/at \d{1,2}(:00)?$/.test(timeString)) {
      const hourMatch = timeString.match(/at (\d{1,2})/);
      if (hourMatch && parseInt(hourMatch[1]) < 7) {
        timeWithPmInference = timeString.replace(/at (\d{1,2})/, 'at $1pm');
      }
    }
    
    const pmInferenceResults = chrono.parse(timeWithPmInference, nowInUserTZ.toJSDate(), { forwardDate: true });
    let pmInferenceParsed = null;
    if (pmInferenceResults.length > 0) {
      pmInferenceParsed = pmInferenceResults[0].start.date().toISOString();
    }
    
    // 3. Test with explicit year
    const explicitYearString = `${timeString} ${nowInUserTZ.year}`;
    const explicitYearResults = chrono.parse(explicitYearString, nowInUserTZ.toJSDate(), { forwardDate: true });
    let explicitYearParsed = null;
    if (explicitYearResults.length > 0) {
      explicitYearParsed = explicitYearResults[0].start.date().toISOString();
    }
    
    // Return all results for comparison
    res.json({
      success: true,
      timeString,
      reference: {
        now: nowInUserTZ.toString(),
        year: nowInUserTZ.year,
        month: nowInUserTZ.month,
        day: nowInUserTZ.day,
        hour: nowInUserTZ.hour
      },
      regularParsing: {
        raw: regularResults,
        iso: regularParsed,
        display: regularParsed ? new Date(regularParsed).toString() : null,
        year: regularParsed ? new Date(regularParsed).getFullYear() : null
      },
      pmInference: {
        modifiedString: timeWithPmInference,
        raw: pmInferenceResults,
        iso: pmInferenceParsed,
        display: pmInferenceParsed ? new Date(pmInferenceParsed).toString() : null,
        year: pmInferenceParsed ? new Date(pmInferenceParsed).getFullYear() : null
      },
      explicitYear: {
        modifiedString: explicitYearString,
        raw: explicitYearResults,
        iso: explicitYearParsed,
        display: explicitYearParsed ? new Date(explicitYearParsed).toString() : null,
        year: explicitYearParsed ? new Date(explicitYearParsed).getFullYear() : null
      }
    });
  } catch (err) {
    console.error("TEST - Error testing time parsing:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/boxes endpoint with enhanced logging and year checks
app.post('/api/boxes', async (req, res) => {
  try {
    const { userId, content, time_type, time_value, reminder_offset } = req.body;
    
    console.log("POST /api/boxes - Request received:", {
      userId: userId ? userId.substring(0, 5) + "..." : null, // Truncate for privacy
      contentLength: content ? content.length : 0,
      time_type,
      raw_time_value: time_value,
      source: req.get('User-Agent'), // Help identify if request is from web or API
      reminder_offset
    });

    const userResult = await pool.query('SELECT time_zone FROM users WHERE user_id = $1', [userId]);
    const userTimeZone = userResult.rows[0]?.time_zone || 'UTC';
    console.log('POST /api/boxes - User timezone:', userTimeZone);

    let parsedTimestamp = null;

    if (time_value && time_value !== 'none') {
      console.log("POST /api/boxes - Processing time:", time_value);
      
      // First check if time_value is already a valid ISO string
      const isISODate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(time_value);
      console.log("POST /api/boxes - Is ISO format?", isISODate);
      
      if (isISODate) {
        // It's already formatted as ISO, just ensure it's in UTC
        parsedTimestamp = DateTime.fromISO(time_value).toUTC().toISO();
        console.log('POST /api/boxes - Already ISO format - converted to UTC:', parsedTimestamp);
      } else {
        // Parse natural language time
        const nowInUserTZ = DateTime.now().setZone(userTimeZone);
        console.log('POST /api/boxes - Reference time (user TZ):', nowInUserTZ.toString());
        console.log('POST /api/boxes - Reference year:', nowInUserTZ.year);
        console.log('POST /api/boxes - Reference month:', nowInUserTZ.month);
        console.log('POST /api/boxes - Reference day:', nowInUserTZ.day);

        // Enhanced time parsing with better handling for various scenarios
        let timeString = time_value;
        
        // Handle "at X" expressions for any time phrase (not just tonight)
        if (/at \d{1,2}(:00)?$/.test(time_value)) {
          const hourMatch = time_value.match(/at (\d{1,2})/);
          if (hourMatch && parseInt(hourMatch[1]) < 7) {
            timeString = time_value.replace(/at (\d{1,2})/, 'at $1pm');
            console.log('POST /api/boxes - Assuming PM for ambiguous time:', timeString);
          }
        }

        // Log what is being passed to chrono-node
        console.log('POST /api/boxes - Passing to chrono-node:', {
          timeString,
          refDateObj: nowInUserTZ.toJSDate(),
          refDateStr: nowInUserTZ.toJSDate().toString(),
          options: { forwardDate: true }
        });

        const parsedResults = chrono.parse(timeString, nowInUserTZ.toJSDate(), { forwardDate: true });
        console.log('POST /api/boxes - Raw chrono-node results:', JSON.stringify(parsedResults, null, 2));

        if (parsedResults.length > 0) {
          const userLocalDate = parsedResults[0].start.date();
          console.log('POST /api/boxes - Parsed date object:', userLocalDate);
          console.log('POST /api/boxes - Parsed date string:', userLocalDate.toString());
          console.log('POST /api/boxes - Parsed year:', userLocalDate.getFullYear());
          console.log('POST /api/boxes - Parsed month:', userLocalDate.getMonth() + 1);
          console.log('POST /api/boxes - Parsed day:', userLocalDate.getDate());
          console.log('POST /api/boxes - Parsed hours:', userLocalDate.getHours());
          
          // Check for year anomalies and fix if needed
          if (userLocalDate.getFullYear() !== nowInUserTZ.year) {
            console.log('POST /api/boxes - Year mismatch detected!');
            console.log('POST /api/boxes - Original year:', userLocalDate.getFullYear());
            
            // Force the current year
            userLocalDate.setFullYear(nowInUserTZ.year);
            
            console.log('POST /api/boxes - Corrected year:', userLocalDate.getFullYear());
          }

          // Convert to ISO string for storage
          parsedTimestamp = userLocalDate.toISOString();
          console.log('POST /api/boxes - Final parsed timestamp (UTC):', parsedTimestamp);
        } else {
          console.log('POST /api/boxes - Failed to parse time:', time_value);
          throw new Error(`Failed to parse: "${time_value}"`);
        }
      }
    }

    const result = await pool.query(
      `INSERT INTO boxes (user_id, content, time_type, time_value, reminder_offset)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, content, time_type || 'none', parsedTimestamp, reminder_offset || 0]
    );

    // Log what's being stored in DB and returned to client
    console.log('POST /api/boxes - Stored in database:', {
      time_type: result.rows[0].time_type,
      time_value: result.rows[0].time_value
    });

    res.json({ success: true, box: result.rows[0] });
  } catch (err) {
    console.error('POST /api/boxes - Error creating box:', err);
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

// UPDATE a box's content with improved time parsing
app.put('/api/boxes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content, time_type, time_value, reminder_offset, userId } = req.body;
    
    console.log("PUT /api/boxes/:id - Request received:", {
      boxId: id,
      userId: userId ? userId.substring(0, 5) + "..." : null,
      time_type,
      raw_time_value: time_value
    });
    
    // Process time_value if provided and not 'none'
    let parsedTimestamp = time_value;
    
    if (time_value && time_value !== 'none' && userId) {
      // Check if it's already in ISO format
      const isISODate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(time_value);
      console.log("PUT /api/boxes/:id - Is ISO format?", isISODate);
      
      if (!isISODate) {
        // Get user's timezone for natural language parsing
        const userResult = await pool.query('SELECT time_zone FROM users WHERE user_id = $1', [userId]);
        const userTimeZone = userResult.rows[0]?.time_zone || 'UTC';
        console.log('PUT /api/boxes/:id - User timezone:', userTimeZone);
        
        // Parse natural language using user's timezone as reference
        const nowInUserTZ = DateTime.now().setZone(userTimeZone);
        console.log('PUT /api/boxes/:id - Reference time:', nowInUserTZ.toString());
        
        // Enhanced time parsing with better handling for various scenarios
        let timeString = time_value;
        
        // Handle "at X" expressions for any time phrase (not just tonight)
        if (/at \d{1,2}(:00)?$/.test(time_value)) {
          const hourMatch = time_value.match(/at (\d{1,2})/);
          if (hourMatch && parseInt(hourMatch[1]) < 7) {
            timeString = time_value.replace(/at (\d{1,2})/, 'at $1pm');
            console.log('PUT /api/boxes/:id - Assuming PM for ambiguous time:', timeString);
          }
        }
        
        const parsedResults = chrono.parse(timeString, nowInUserTZ.toJSDate(), { forwardDate: true });
        console.log('PUT /api/boxes/:id - Raw chrono-node results:', JSON.stringify(parsedResults, null, 2));
        
        if (parsedResults.length > 0) {
          const userLocalDate = parsedResults[0].start.date();
          console.log('PUT /api/boxes/:id - Parsed date:', userLocalDate.toString());
          console.log('PUT /api/boxes/:id - Parsed year:', userLocalDate.getFullYear());
          
          // Check for year anomalies and fix if needed
          if (userLocalDate.getFullYear() !== nowInUserTZ.year) {
            console.log('PUT /api/boxes/:id - Year mismatch detected!');
            console.log('PUT /api/boxes/:id - Original year:', userLocalDate.getFullYear());
            
            // Force the current year
            userLocalDate.setFullYear(nowInUserTZ.year);
            
            console.log('PUT /api/boxes/:id - Corrected year:', userLocalDate.getFullYear());
          }
          
          // Convert to ISO string for storage
          parsedTimestamp = userLocalDate.toISOString();
          console.log('PUT /api/boxes/:id - Final parsed timestamp:', parsedTimestamp);
        } else {
          console.log('PUT /api/boxes/:id - Failed to parse time:', time_value);
          throw new Error(`Failed to parse: "${time_value}"`);
        }
      }
    }
    
    console.log('PUT /api/boxes/:id - FINAL DB UPDATE - timestamp value:', parsedTimestamp);
    
    const result = await pool.query(
      `UPDATE boxes
       SET content = $1,
           time_type = $2,
           time_value = $3,
           reminder_offset = $4
       WHERE id = $5 RETURNING *`,
      [content, time_type || 'none', parsedTimestamp, reminder_offset, id]
    );
    
    console.log('PUT /api/boxes/:id - RETURNED FROM DB:', result.rows[0].time_value);

    res.json({ success: true, box: result.rows[0] });
  } catch (err) {
    console.error('PUT /api/boxes/:id - Error updating box:', err);
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