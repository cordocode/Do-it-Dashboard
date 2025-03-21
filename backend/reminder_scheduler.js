require('dotenv').config();
const cron = require('node-cron');
const { Pool } = require('pg');
const twilio = require('twilio');
const chrono = require('chrono-node');
const { logStep } = require('./logger');

// Create a Postgres connection pool (adjust configuration as needed)
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: process.env.NODE_ENV === 'development' ? false : { rejectUnauthorized: false },
});

// Twilio configuration
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const twilioNumber = process.env.TWILIO_NUMBER;

/**
 * Helper function to parse a natural language date/time phrase using chrono-node.
 * If you have user-specific time zones, you can incorporate them here.
 * For now, we just parse relative to the current system time.
 */
function parseDateTimePhrase(phrase, refDate, userTimeZone) {
  logStep('Text sent to Chrono-node', { phrase, refDate, userTimeZone });

  const results = chrono.parse(phrase, refDate, { forwardDate: true });
  if (!results || !results.length) {
    logStep('Chrono-node Parsing Result', 'Could not parse date.');
    return null;
  }
  const parsedDate = results[0].start.date();

  logStep('Chrono-node Parsing Result', parsedDate);

  return parsedDate;
}

/**
 * If the task's time_value isn't a valid date, parse it with chrono-node
 * and update the DB with a proper ISO timestamp. 
 */
async function ensureTimeValueIsDate(taskId, timeValue, userId) {
  const userResult = await pool.query('SELECT time_zone FROM users WHERE user_id = $1', [userId]);
  const userTimeZone = userResult.rows[0]?.time_zone || 'UTC';

  const dateCheck = new Date(timeValue);
  if (!isNaN(dateCheck.getTime())) {
    // Already a valid Date string (ISO, etc.), no need to parse
    return dateCheck;
  }
  
  // Adjust reference date to user's timezone
  const refDate = new Date(new Date().toLocaleString("en-US", {timeZone: userTimeZone}));

  // Not a valid date => try parsing with chrono
  const parsedDate = parseDateTimePhrase(timeValue, refDate, userTimeZone);
  if (!parsedDate) {
    // Could not parse, return null so we skip sending a reminder
    return null;
  }
  
  // Store the newly parsed date in ISO format
  const isoString = parsedDate.toISOString();
  await pool.query(
    'UPDATE boxes SET time_value = $1 WHERE id = $2',
    [isoString, taskId]
  );
  
  logStep('Database updated task time_value', { taskId, isoString });
  
  return new Date(isoString);
}

/**
 * Sends an SMS reminder and marks the task as reminded
 */
async function sendReminder(task, userPhone) {
  try {
    await twilioClient.messages.create({
      body: `Reminder: Your task "${task.content}" is due soon!`,
      from: twilioNumber,
      to: userPhone,
    });
    // Mark the task as reminded to avoid duplicate reminders
    await pool.query(
      'UPDATE boxes SET reminder_sent = TRUE WHERE id = $1',
      [task.id]
    );
    console.log(`Reminder sent for task ID ${task.id}`);
  } catch (error) {
    console.error(`Error sending reminder for task ID ${task.id}:`, error);
  }
}

// Cron job: runs every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // Query tasks that have a time-based attribute, a set reminder_offset, and not yet reminded
    const result = await pool.query(
      `SELECT b.*, u.phone_number, u.time_zone 
       FROM boxes b
       JOIN users u ON b.user_id = u.user_id
       WHERE b.time_type <> 'none'
         AND b.time_value IS NOT NULL
         AND b.reminder_offset IS NOT NULL
         AND b.reminder_sent = FALSE`
    );
    const tasks = result.rows;

    for (const task of tasks) {
      // 1) Ensure time_value is a valid date; if not, parse & store
      const validDate = await ensureTimeValueIsDate(task.id, task.time_value, task.user_id);
      if (!validDate) {
        // Could not parse => skip sending a reminder
        continue;
      }

      // 2) Calculate the reminder time
      const reminderTime = new Date(validDate.getTime() - task.reminder_offset * 60000);

      // 3) If we're at or past the reminder time, send the SMS
      if (now >= reminderTime && task.phone_number) {
        await sendReminder(task, task.phone_number);
      }
    }
  } catch (error) {
    logStep('Error in reminder scheduler', error.message);
  }
});

console.log('Reminder scheduler started.');
