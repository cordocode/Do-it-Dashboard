/***********************************
 * server.js — Full, combined code
 ***********************************/

// Suppress punycode deprecation warning
process.emitWarning = (function () {
  const originalEmitWarning = process.emitWarning;
  return function (warning, type, code, ...args) {
    if (code === 'DEP0040') return;
    return originalEmitWarning.call(process, warning, type, code, ...args);
  };
})();

// Force UTC timezone for all date operations in Node
process.env.TZ = 'UTC';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const chrono = require('chrono-node');
const { DateTime } = require('luxon');

// Decide whether to use SSL in production.
function getSSLConfig() {
  if (process.env.NODE_ENV === 'development') {
    // local dev typically doesn't use SSL
    return false;
  } else {
    // on AWS, often need to allow self-signed
    return { rejectUnauthorized: false };
  }
}

// Create your Postgres connection pool.
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: getSSLConfig(),
});

// Ensure each new DB connection uses UTC
pool.on('connect', async (client) => {
  await client.query('SET timezone = "UTC"');
});

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/* ===============================================
   Root route for Elastic Beanstalk health checks
=============================================== */
app.get('/', (req, res) => {
  res.send('Server is running');
});

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
        phone_verified: profile.phone_verified,
        // Make sure to include time_zone here:
        time_zone: profile.time_zone
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
   5) Simple time parser 
=============================================== */
app.post('/api/parse-time', async (req, res) => {
  try {
    const { timeString, timeZone } = req.body;
    
    console.log("PARSE-TIME - Request received:", {
      timeString,
      timeZone,
      serverTime: new Date().toString(),
      serverTimeISO: new Date().toISOString()
    });
    
    if (!timeString) {
      return res.status(400).json({ success: false, error: 'Time string is required' });
    }
    
    const userTimeZone = timeZone || 'UTC';
    const nowInUserTZ = DateTime.now().setZone(userTimeZone);
    
    console.log("PARSE-TIME - Reference time in user timezone:", {
      userTimeZone,
      nowInUserTZ: nowInUserTZ.toString(),
      nowInUserTZformatted: nowInUserTZ.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
      offset: nowInUserTZ.offset / 60, // convert minutes to hours
    });
    
    let parsedTimestamp = null;
    
    // Example of "at X" => "at Xpm" logic
    let processedTimeString = timeString;
    if (/at \d{1,2}(:00)?$/.test(timeString)) {
      const hourMatch = timeString.match(/at (\d{1,2})/);
      if (hourMatch && parseInt(hourMatch[1]) < 7) {
        processedTimeString = timeString.replace(/at (\d{1,2})/, 'at $1pm');
        console.log("PARSE-TIME - Applied PM inference:", {
          original: timeString,
          processed: processedTimeString
        });
      }
    }
    
    // Parse the time using chrono-node
    const parsedResults = chrono.parse(processedTimeString, nowInUserTZ.toJSDate(), { forwardDate: true });
    console.log("PARSE-TIME - Chrono parse results:", JSON.stringify(parsedResults, null, 2));
    
    if (parsedResults.length > 0) {
      // Get the parsed components directly from the chrono result
      const components = parsedResults[0].start;
      
      // Log the raw date for debugging
      const parsedDate = components.date();
      console.log("PARSE-TIME - Raw parsed date:", {
        raw: parsedDate.toString(),
        iso: parsedDate.toISOString(),
        year: parsedDate.getFullYear(),
        month: parsedDate.getMonth() + 1,
        day: parsedDate.getDate(),
        hours: parsedDate.getHours(),
        minutes: parsedDate.getMinutes(),
      });
      
      // Extract components directly from chrono results
      // This is the key fix - we don't use the JS Date object directly
      const year = components.get('year');
      const month = components.get('month');
      const day = components.get('day');
      let hour = components.get('hour') || 0;
      const minute = components.get('minute') || 0;
      const second = components.get('second') || 0;
      const meridiem = components.get('meridiem');
      
      // Adjust hour based on meridiem if available
      if (meridiem === 1 && hour < 12) {
        hour += 12; // Convert to 24-hour format (1pm = 13)
      } else if (meridiem === 0 && hour === 12) {
        hour = 0; // 12am = 0 in 24-hour format
      }
      
      // Create a datetime in the user's timezone from the parsed components
      const dtLocal = DateTime.fromObject({
        year: year,
        month: month,
        day: day,
        hour: hour,
        minute: minute,
        second: second
      }, { zone: userTimeZone });
      
      // Log this for debugging
      console.log("PARSE-TIME - As Luxon DateTime in user timezone:", {
        dtLocal: dtLocal.toString(),
        formatted: dtLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
        offset: dtLocal.offset / 60 // convert minutes to hours
      });
      
      // Convert to UTC
      const dtUTC = dtLocal.toUTC();
      console.log("PARSE-TIME - Converted to UTC:", {
        dtUTC: dtUTC.toString(),
        formatted: dtUTC.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
        offset: dtUTC.offset / 60 // should be 0
      });
      
      parsedTimestamp = dtUTC.toISO();
      console.log("PARSE-TIME - Final ISO timestamp:", parsedTimestamp);
      
      res.json({
        success: true,
        input: timeString,
        parsed: parsedTimestamp,
        display: new Date(parsedTimestamp).toLocaleString('en-US', {timeZone: userTimeZone})
      });
    } else {
      console.log("PARSE-TIME - Failed to parse time expression");
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
   6) Boxes CRUD
=============================================== */

// Test endpoint for timezone debugging
app.get('/timezone-debug', (req, res) => {
  const testTime = '2025-03-24T21:00:00.000Z';
  console.log('DEBUG - About to send test time:', testTime);
  res.json({ testTime });
});

/**
 * POST /api/boxes
 * - Creates a new box
 * - Converts user local time -> UTC if time_value is provided
 */
app.post('/api/boxes', async (req, res) => {
  try {
    const { userId, content, time_type, time_value, reminder_offset } = req.body;
    
    console.log("POST /api/boxes - Request received:", {
      userId: userId ? userId.substring(0, 5) + "..." : null,
      contentLength: content ? content.length : 0,
      time_type,
      raw_time_value: time_value,
      source: req.get('User-Agent'),
      reminder_offset
    });

    // 1) Retrieve user's timezone from DB or default to UTC
    const userResult = await pool.query('SELECT time_zone FROM users WHERE user_id = $1', [userId]);
    const userTimeZone = userResult.rows[0]?.time_zone || 'UTC';
    console.log('POST /api/boxes - User timezone:', userTimeZone);

    let parsedTimestamp = null;

    // 2) If we have a time_value, parse it properly
    if (time_value && time_value !== 'none') {
      console.log("POST /api/boxes - Processing time:", time_value);

      // Check if time_value is an ISO string
      const isISODate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(time_value);
      console.log("POST /api/boxes - Is ISO format?", isISODate);

      if (isISODate) {
        // FIXED: Check if already in UTC format (has Z suffix)
        if (time_value.endsWith('Z')) {
          // It's already UTC - keep it as is
          parsedTimestamp = time_value;
          console.log("POST /api/boxes - Already UTC, keeping as is:", parsedTimestamp);
        } else {
          // For non-UTC ISO strings, interpret as user's local time and convert to UTC
          parsedTimestamp = DateTime
            .fromISO(time_value)
            .setZone(userTimeZone, { keepLocalTime: true })
            .toUTC()
            .toISO();
          console.log("POST /api/boxes - Converted local ISO to UTC:", parsedTimestamp);
        }
      } else {
        // Natural language parse
        const nowInUserTZ = DateTime.now().setZone(userTimeZone);
        console.log('POST /api/boxes - Reference time (user TZ):', nowInUserTZ.toString());

        const parsedResults = chrono.parse(time_value, nowInUserTZ.toJSDate(), { forwardDate: true });
        console.log('POST /api/boxes - Raw chrono-node results:', JSON.stringify(parsedResults, null, 2));

        if (parsedResults.length > 0) {
          // Extract components directly from chrono results
          const components = parsedResults[0].start;
          const year = components.get('year');
          const month = components.get('month');
          const day = components.get('day');
          let hour = components.get('hour') || 0;
          const minute = components.get('minute') || 0;
          const second = components.get('second') || 0;
          const meridiem = components.get('meridiem');
          
          // Adjust hour based on meridiem if available
          if (meridiem === 1 && hour < 12) {
            hour += 12; // Convert to 24-hour format (1pm = 13)
          } else if (meridiem === 0 && hour === 12) {
            hour = 0; // 12am = 0 in 24-hour format
          }
          
          // Create a datetime in the user's timezone
          const dtLocal = DateTime.fromObject({
            year: year,
            month: month,
            day: day,
            hour: hour,
            minute: minute,
            second: second
          }, { zone: userTimeZone });
          
          parsedTimestamp = dtLocal.toUTC().toISO();

          console.log('POST /api/boxes - Natural language parse, final UTC:', parsedTimestamp);
        } else {
          console.log('POST /api/boxes - Failed to parse time:', time_value);
        }
      }
      
      // Added logging for time value analysis
      console.log("POST /api/boxes - Time value analysis:", {
        originalInput: time_value,
        parsedAs: parsedTimestamp,
        parsedTimestampType: typeof parsedTimestamp,
        isUTCTime: parsedTimestamp && parsedTimestamp.endsWith('Z'),
        userTimeZone,
        referenceTime: DateTime.now().setZone(userTimeZone).toString(),
        serverCurrentTime: new Date().toString()
      });
    }

    // 3) Insert into DB
    const result = await pool.query(
      `INSERT INTO boxes (user_id, content, time_type, time_value, reminder_offset)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, content, time_type || 'none', parsedTimestamp, reminder_offset || 0]
    );

    // Added logging for database operation result
    console.log("POST /api/boxes - Database operation result:", {
      timeTypeStored: result.rows[0].time_type,
      timeValueStored: result.rows[0].time_value,
      timeValueType: typeof result.rows[0].time_value
    });

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

/**
 * GET /api/boxes
 * - Reads all boxes for a given user
 */
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

/**
 * DELETE /api/boxes/:id
 * - Deletes a box by ID
 */
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

/**
 * PUT /api/boxes/:id
 * - Updates a box's content/time
 * - Converts local user time → UTC if needed
 */
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

    // 1) Retrieve user's timezone
    let userTimeZone = 'UTC';
    if (userId) {
      const userResult = await pool.query('SELECT time_zone FROM users WHERE user_id = $1', [userId]);
      userTimeZone = userResult.rows[0]?.time_zone || 'UTC';
    }
    console.log("PUT /api/boxes/:id - Using userTimeZone:", userTimeZone);

    let parsedTimestamp = null;

    // 2) If we have a time_value, parse it
    if (time_value && time_value !== 'none') {
      console.log("PUT /api/boxes/:id - Processing time:", time_value);

      const isISODate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(time_value);
      console.log("PUT /api/boxes/:id - Is ISO format?", isISODate);

      if (isISODate) {
        // FIXED: Check if already in UTC format (has Z suffix)
        if (time_value.endsWith('Z')) {
          // It's already UTC - keep it as is
          parsedTimestamp = time_value;
          console.log("PUT /api/boxes/:id - Already UTC, keeping as is:", parsedTimestamp);
        } else {
          // For non-UTC ISO strings, interpret as user's local time and convert to UTC
          parsedTimestamp = DateTime
            .fromISO(time_value)
            .setZone(userTimeZone, { keepLocalTime: true })
            .toUTC()
            .toISO();
          console.log("PUT /api/boxes/:id - Converted local ISO to UTC:", parsedTimestamp);
        }
      } else {
        // Natural language parse
        const nowInUserTZ = DateTime.now().setZone(userTimeZone);
        console.log("PUT /api/boxes/:id - Reference time (user TZ):", nowInUserTZ.toString());

        const parsedResults = chrono.parse(time_value, nowInUserTZ.toJSDate(), { forwardDate: true });
        console.log("PUT /api/boxes/:id - Raw chrono-node results:", parsedResults);

        if (parsedResults.length > 0) {
          // Extract components directly from chrono results
          const components = parsedResults[0].start;
          const year = components.get('year');
          const month = components.get('month');
          const day = components.get('day');
          let hour = components.get('hour') || 0;
          const minute = components.get('minute') || 0;
          const second = components.get('second') || 0;
          const meridiem = components.get('meridiem');
          
          // Adjust hour based on meridiem if available
          if (meridiem === 1 && hour < 12) {
            hour += 12; // Convert to 24-hour format (1pm = 13)
          } else if (meridiem === 0 && hour === 12) {
            hour = 0; // 12am = 0 in 24-hour format
          }
          
          // Create a datetime in the user's timezone
          const dtLocal = DateTime.fromObject({
            year: year,
            month: month,
            day: day,
            hour: hour,
            minute: minute,
            second: second
          }, { zone: userTimeZone });
          
          parsedTimestamp = dtLocal.toUTC().toISO();

          console.log("PUT /api/boxes/:id - Natural language parse, final UTC:", parsedTimestamp);
        } else {
          console.log("PUT /api/boxes/:id - Failed to parse time:", time_value);
        }
      }
      
      // Added logging for time value analysis
      console.log("PUT /api/boxes/:id - Time value analysis:", {
        originalInput: time_value,
        parsedAs: parsedTimestamp,
        parsedTimestampType: typeof parsedTimestamp,
        isUTCTime: parsedTimestamp && parsedTimestamp.endsWith('Z'),
        userTimeZone,
        referenceTime: DateTime.now().setZone(userTimeZone).toString(),
        serverCurrentTime: new Date().toString()
      });
    }

    console.log('PUT /api/boxes/:id - FINAL DB UPDATE - timestamp value:', parsedTimestamp);

    // 3) Update the DB
    const result = await pool.query(
      `UPDATE boxes
       SET content = $1,
           time_type = $2,
           time_value = $3,
           reminder_offset = $4
       WHERE id = $5
       RETURNING *`,
      [content, time_type || 'none', parsedTimestamp, reminder_offset, id]
    );

    // Added logging for database operation result
    console.log("PUT /api/boxes/:id - Database operation result:", {
      timeTypeStored: result.rows[0].time_type,
      timeValueStored: result.rows[0].time_value,
      timeValueType: typeof result.rows[0].time_value
    });

    console.log('PUT /api/boxes/:id - RETURNED FROM DB:', result.rows[0].time_value);
    
    res.json({ success: true, box: result.rows[0] });
  } catch (err) {
    console.error('PUT /api/boxes/:id - Error updating box:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ===============================================
   Listen on port
=============================================== */
// Attach Twilio service
const setupTwilioService = require('./twilioservice');
setupTwilioService(pool).routes(app);

// Display server timezone information
console.log(`Server timezone: ${process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone}`);
console.log(`Current server time: ${new Date().toISOString()}`);

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});