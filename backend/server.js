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
    // local dev typically doesn’t use SSL
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
   2) PUT update user’s first_name
=============================================== */
app.put('/api/user-profile', async (req, res) => {
  try {
    const { userId, firstName } = req.body;
    const result = await pool.query(
      'UPDATE users SET first_name = $1 WHERE user_id = $2 RETURNING *',
      [firstName, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
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
app.post('/api/boxes', async (req, res) => {
  try {
    const { userId, content } = req.body;
    const result = await pool.query(
      'INSERT INTO boxes (user_id, content) VALUES ($1, $2) RETURNING *',
      [userId, content]
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

// UPDATE a box’s content
app.put('/api/boxes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const result = await pool.query(
      'UPDATE boxes SET content = $1 WHERE id = $2 RETURNING *',
      [content, id]
    );
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
   8) Finally, start the server
=============================================== */
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
