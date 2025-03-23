/***********************************
 * server.js — Full, combined code
 ***********************************/
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
    
    // Added logging
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
    
    // Added logging
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
        // Added logging
        console.log("PARSE-TIME - Applied PM inference:", {
          original: timeString,
          processed: processedTimeString
        });
      }
    }
    
    const parsedResults = chrono.parse(processedTimeString, nowInUserTZ.toJSDate(), { forwardDate: true });
    // Added logging
    console.log("PARSE-TIME - Chrono parse results:", JSON.stringify(parsedResults, null, 2));
    
    if (parsedResults.length > 0) {
      const parsedDate = parsedResults[0].start.date();
      // Added logging
      console.log("PARSE-TIME - Raw parsed date:", {
        raw: parsedDate.toString(),
        iso: parsedDate.toISOString(),
        year: parsedDate.getFullYear(),
        month: parsedDate.getMonth() + 1,
        day: parsedDate.getDate(),
        hours: parsedDate.getHours(),
        minutes: parsedDate.getMinutes(),
        asJSDate: parsedDate instanceof Date
      });
      
      // Fix year if needed
      if (parsedDate.getFullYear() !== nowInUserTZ.year) {
        parsedDate.setFullYear(nowInUserTZ.year);
        // Added logging
        console.log("PARSE-TIME - Fixed year:", parsedDate.toString());
      }
      
      // Convert to DateTime and handle timezone (** this is your fix **)
      const dtLocal = DateTime.fromJSDate(parsedDate, { zone: userTimeZone });
      // Added logging
      console.log("PARSE-TIME - As Luxon DateTime in user timezone:", {
        dtLocal: dtLocal.toString(),
        formatted: dtLocal.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
        offset: dtLocal.offset / 60 // convert minutes to hours
      });
      
      // Convert to UTC
      const dtUTC = dtLocal.toUTC();
      // Added logging
      console.log("PARSE-TIME - Converted to UTC:", {
        dtUTC: dtUTC.toString(),
        formatted: dtUTC.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ'),
        offset: dtUTC.offset / 60 // should be 0
      });
      
      parsedTimestamp = dtUTC.toISO();
      // Added logging
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
        // Interpret the ISO string as local user time, then convert to UTC
        parsedTimestamp = DateTime
          .fromISO(time_value, { zone: userTimeZone })
          .toUTC()
          .toISO();
        console.log("POST /api/boxes - Interpreted ISO as user local, final UTC:", parsedTimestamp);

      } else {
        // Natural language parse
        const nowInUserTZ = DateTime.now().setZone(userTimeZone);
        console.log('POST /api/boxes - Reference time (user TZ):', nowInUserTZ.toString());

        const parsedResults = chrono.parse(time_value, nowInUserTZ.toJSDate(), { forwardDate: true });
        console.log('POST /api/boxes - Raw chrono-node results:', JSON.stringify(parsedResults, null, 2));

        if (parsedResults.length > 0) {
          const userLocalDate = parsedResults[0].start.date();
          // If chrono picks a weird year, fix it
          if (userLocalDate.getFullYear() !== nowInUserTZ.year) {
            userLocalDate.setFullYear(nowInUserTZ.year);
          }

          const dtLocal = DateTime.fromJSDate(userLocalDate, { zone: userTimeZone });
          parsedTimestamp = dtLocal.toUTC().toISO();

          console.log('POST /api/boxes - Natural language parse, final UTC:', parsedTimestamp);
        } else {
          console.log('POST /api/boxes - Failed to parse time:', time_value);
          // Decide how you want to handle this
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
        // Interpret the ISO string in the user's local zone, then convert to UTC
        parsedTimestamp = DateTime
          .fromISO(time_value, { zone: userTimeZone })
          .toUTC()
          .toISO();
        console.log("PUT /api/boxes/:id - Interpreted ISO as user local, final UTC:", parsedTimestamp);

      } else {
        // Natural language parse
        const nowInUserTZ = DateTime.now().setZone(userTimeZone);
        console.log("PUT /api/boxes/:id - Reference time (user TZ):", nowInUserTZ.toString());

        const parsedResults = chrono.parse(time_value, nowInUserTZ.toJSDate(), { forwardDate: true });
        console.log("PUT /api/boxes/:id - Raw chrono-node results:", parsedResults);

        if (parsedResults.length > 0) {
          const userLocalDate = parsedResults[0].start.date();
          if (userLocalDate.getFullYear() !== nowInUserTZ.year) {
            userLocalDate.setFullYear(nowInUserTZ.year);
          }
          const dtLocal = DateTime.fromJSDate(userLocalDate, { zone: userTimeZone });
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
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});