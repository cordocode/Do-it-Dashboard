// middlened/twilioMiddleware.js - A script to run as a separate service

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const setupOpenAIService = require('./openAIservice');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com';

// Initialize OpenAI service
const openAIService = setupOpenAIService();

// Middleware to relay Twilio webhook requests to your backend after AI processing
app.post('/twilio/relay', async (req, res) => {
  const userMessage = req.body.Body;
  const fromNumber = req.body.From;

  try {
    // Process the message through our OpenAI service
    const processResult = await openAIService.processSmsMessage(userMessage, fromNumber);
    
    // Take action based on the AI's understanding of the message
    if (processResult.success && processResult.intentData) {
      const intent = processResult.intentData.intent;
      
      // Handle different intents with calls to your backend
      if (intent === 'add_task' && processResult.intentData.task_content) {
        // Get the user ID from the phone number
        const userResponse = await axios.get(
          `${API_BASE_URL}/api/user-by-phone?phone=${encodeURIComponent(fromNumber)}`
        );
        
        if (userResponse.data.success) {
          const userId = userResponse.data.user.user_id;
          
          // Add the task to the database through your backend API
          await axios.post(`${API_BASE_URL}/api/boxes`, {
            userId,
            content: processResult.intentData.task_content
          });
        }
      }
      
      // Similarly, handle other intents...
    }
    
    // Send the AI-generated response back to the user
    res.send(`<Response><Message>${processResult.responseText}</Message></Response>`);
    
  } catch (err) {
    console.error('Error in twilio relay:', err);
    res.send('<Response><Message>Sorry, I encountered an error. Please try again later.</Message></Response>');
  }
});

// Start the server
const port = process.env.MIDDLENED_PORT || 3000;
app.listen(port, () => {
  console.log(`Middlened server listening on port ${port}`);
});