// test-webhook.js
const axios = require('axios');

async function simulateTwilioWebhook() {
  // Use the phone number format that worked in our previous test
  const yourPhoneNumber = '+13039094182';
  
  console.log("Simulating Twilio webhook request...");
  
  try {
    // This simulates a POST request that Twilio would make to your webhook
    const response = await axios.post('http://localhost:8080/twilio/webhook', 
      {
        Body: "Add a task to buy groceries",
        From: yourPhoneNumber
      },
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    
    console.log("Response status:", response.status);
    console.log("Response data:", response.data);
    console.log("✅ Test complete!");
  } catch (error) {
    console.error("Error during test:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

simulateTwilioWebhook().catch(console.error);