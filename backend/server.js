// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const { Pool } = require('pg');


const getSSLConfig = () => {
  if (process.env.NODE_ENV === 'development') {
    return false; // Matches your local server configuration
  } else {
    return { 
      rejectUnauthorized: false // Matches your previous production configuration
    };
  }
};

// Create a new pool using .env variables
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: getSSLConfig()
});

// Get user profile
app.get('/api/user-profile', async (req, res) => {
  try {
    const { userId } = req.query;
    
    // First check if user exists
    let userResult = await pool.query(
      'SELECT * FROM users WHERE user_id = $1',
      [userId]
    );
    
    // If user doesn't exist, create a new record
    if (userResult.rows.length === 0) {
      await pool.query(
        'INSERT INTO users (user_id) VALUES ($1)',
        [userId]
      );
      
      // Get the newly created user
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
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/user-profile', async (req, res) => {
  try {
    const { userId, firstName } = req.body;
    
    // Update the user record
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

// Add this to both server.js files
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
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 1) Test endpoint
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({ success: true, time: result.rows[0].current_time });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2) CREATE a new box (POST /api/boxes)
app.post('/api/boxes', async (req, res) => {
  try {
    const { userId, content } = req.body;
    const result = await pool.query(
      'INSERT INTO boxes (user_id, content) VALUES ($1, $2) RETURNING *',
      [userId, content]
    );
    res.json({ success: true, box: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3) READ boxes by user (GET /api/boxes?userId=XYZ)
app.get('/api/boxes', async (req, res) => {
  try {
    const { userId } = req.query;
    const result = await pool.query(
      'SELECT * FROM boxes WHERE user_id = $1 ORDER BY id ASC',
      [userId]
    );
    res.json({ success: true, boxes: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4) DELETE a box (DELETE /api/boxes/:id)
app.delete('/api/boxes/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM boxes WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5) UPDATE box content (PUT /api/boxes/:id) -- NEW
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
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const setupTwilioService = require('./twilioservice');
const twilioService = setupTwilioService(pool);
twilioService.routes(app);

// Just a test to confirm server runs
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Start the server
const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});