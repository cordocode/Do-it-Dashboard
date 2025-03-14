// openAIservice.js - Service to process SMS messages with OpenAI and interface with backend

const axios = require('axios');
const { OpenAI } = require('openai');

// Configure based on environment
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Main service module for handling message intent analysis and backend communication
 */
function setupOpenAIService() {
  /**
   * Analyzes user message to determine intent
   * @param {string} message - The user's SMS message
   * @param {string} userId - The user's ID in the system
   * @returns {Promise<Object>} - The parsed intent and relevant data
   */
  async function analyzeMessageIntent(message, userId) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a task manager assistant that helps users manage their tasks via SMS. Identify if the user is trying to add a task, remove a task, list tasks, or asking for general help." },
          { role: "user", content: message }
        ],
        functions: [
          {
            name: "parse_task_intent",
            description: "Parse the user's message to determine their intent with tasks",
            parameters: {
              type: "object",
              properties: {
                intent: {
                  type: "string",
                  enum: ["add_task", "remove_task", "list_tasks", "get_help", "unknown"],
                  description: "The detected intent of the user's message"
                },
                task_content: {
                  type: "string",
                  description: "The content of the task if the intent is to add a task"
                },
                task_identifier: {
                  type: "string",
                  description: "An identifier for which task to remove (may be a number, keyword, or partial description)"
                }
              },
              required: ["intent"]
            }
          }
        ],
        function_call: { name: "parse_task_intent" }
      });

      // Extract the function call result
      const intentData = JSON.parse(
        completion.choices[0].message.function_call.arguments
      );
      
      return intentData;
    } catch (error) {
      console.error('Error analyzing message intent:', error);
      return { intent: 'unknown', error: error.message };
    }
  }

  /**
   * Generates a response to the user based on the detected intent
   * @param {Object} intentData - The intent data from analyzeMessageIntent
   * @returns {Promise<string>} - The response message to send to the user
   */
  async function generateUserResponse(intentData, userId = null) {
    try {
      let systemPrompt = "You are a friendly task manager assistant responding to SMS messages. ";
      
      // Add context about existing tasks if we're removing tasks
      let userTasksContext = "";
      if (intentData.intent === "remove_task" && userId) {
        try {
          const tasks = await fetchUserTasks(userId);
          if (tasks && tasks.length > 0) {
            userTasksContext = "The user has the following tasks:\n" + 
              tasks.map((task, index) => `${index + 1}. ${task.content}`).join("\n") + "\n\n";
          }
        } catch (error) {
          console.error('Error fetching user tasks:', error);
        }
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { 
            role: "system", 
            content: systemPrompt + "Keep responses brief and conversational, like you're texting."
          },
          { 
            role: "user", 
            content: userTasksContext + `Generate a response for a user with intent: ${intentData.intent}` +
              (intentData.task_content ? `, task content: ${intentData.task_content}` : '') +
              (intentData.task_identifier ? `, task identifier: ${intentData.task_identifier}` : '')
          }
        ]
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating response:', error);
      return "I'm having trouble processing your request. Please try again later.";
    }
  }

  /**
   * Fetches the user's existing tasks from the backend
   * @param {string} userId - The user's ID
   * @returns {Promise<Array>} - Array of user tasks
   */
  async function fetchUserTasks(userId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/boxes?userId=${userId}`);
      if (response.data.success) {
        return response.data.boxes;
      }
      return [];
    } catch (error) {
      console.error('Error fetching user tasks:', error);
      throw error;
    }
  }

  /**
   * Adds a new task for the user
   * @param {string} userId - The user's ID
   * @param {string} content - The task content
   * @returns {Promise<Object>} - The created task
   */
  async function addTask(userId, content) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/boxes`, {
        userId,
        content
      });
      
      if (response.data.success) {
        return response.data.box;
      }
      throw new Error('Failed to add task');
    } catch (error) {
      console.error('Error adding task:', error);
      throw error;
    }
  }

  /**
   * Removes a task by finding the best match to the user's description
   * @param {string} userId - The user's ID
   * @param {string} taskIdentifier - Description or identifier for the task
   * @returns {Promise<Object>} - Result of the operation
   */
  async function removeTask(userId, taskIdentifier) {
    try {
      // First get all user tasks
      const tasks = await fetchUserTasks(userId);
      
      if (tasks.length === 0) {
        return { success: false, error: 'No tasks found' };
      }

      // Try to identify which task to remove
      // First check if it's a number (index)
      let taskToRemove = null;
      const taskIndex = parseInt(taskIdentifier) - 1; // Convert to 0-based index
      
      if (!isNaN(taskIndex) && taskIndex >= 0 && taskIndex < tasks.length) {
        // User specified task by number
        taskToRemove = tasks[taskIndex];
      } else {
        // Try to find by content similarity
        // This is a simple implementation - in production, you might use
        // OpenAI's embeddings API for better similarity matching
        taskToRemove = tasks.find(task => 
          task.content.toLowerCase().includes(taskIdentifier.toLowerCase())
        );
      }

      if (!taskToRemove) {
        return { 
          success: false, 
          error: 'Could not identify which task to remove',
          tasks // Return tasks so we can show options to the user
        };
      }

      // Remove the identified task
      const response = await axios.delete(`${API_BASE_URL}/api/boxes/${taskToRemove.id}`);
      
      if (response.data.success) {
        return { 
          success: true, 
          removedTask: taskToRemove 
        };
      }
      
      throw new Error('Failed to remove task');
    } catch (error) {
      console.error('Error removing task:', error);
      throw error;
    }
  }

  /**
   * Processes an incoming SMS and generates appropriate actions and responses
   * @param {string} message - The incoming message text
   * @param {string} fromNumber - The phone number the message came from
   * @returns {Promise<Object>} - Processing result with response text
   */
  async function processSmsMessage(message, fromNumber) {
    try {
      // 1. First, identify the user from the phone number
      const user = await identifyUserFromPhone(fromNumber);
      
      if (!user) {
        return {
          success: false,
          responseText: 'Your number is not linked to an account.'
        };
      }

      // 2. Analyze the message intent
      const intentData = await analyzeMessageIntent(message, user.user_id);
      
      // 3. Take action based on intent
      let actionResult = null;
      
      switch (intentData.intent) {
        case 'add_task':
          if (intentData.task_content) {
            actionResult = await addTask(user.user_id, intentData.task_content);
          }
          break;
          
        case 'remove_task':
          if (intentData.task_identifier) {
            actionResult = await removeTask(user.user_id, intentData.task_identifier);
          }
          break;
          
        case 'list_tasks':
          const tasks = await fetchUserTasks(user.user_id);
          actionResult = { success: true, tasks };
          break;
      }

      // 4. Generate a response to the user
      let responseText = await generateUserResponse(intentData, user.user_id);
      
      // Enhance response with task list if necessary
      if (intentData.intent === 'list_tasks' && actionResult?.tasks) {
        const taskList = actionResult.tasks
          .map((task, index) => `${index + 1}. ${task.content}`)
          .join('\n');
        
        responseText += '\n\n' + (taskList || 'You have no tasks.');
      }

      return {
        success: true,
        responseText,
        intentData,
        actionResult
      };
    } catch (error) {
      console.error('Error processing SMS:', error);
      return {
        success: false,
        responseText: 'Sorry, I encountered an error processing your message. Please try again later.',
        error: error.message
      };
    }
  }

  /**
   * Identifies a user from their phone number
   * @param {string} phoneNumber - The user's phone number
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async function identifyUserFromPhone(phoneNumber) {
    try {
      // Normalize phone number to match database format
      const normalizedPhone = phoneNumber.replace(/\s/g, '');
      
      const response = await axios.get(
        `${API_BASE_URL}/api/user-by-phone?phone=${encodeURIComponent(normalizedPhone)}`
      );
      
      if (response.data.success && response.data.user) {
        return response.data.user;
      }
      
      return null;
    } catch (error) {
      console.error('Error identifying user from phone:', error);
      return null;
    }
  }

  return {
    processSmsMessage,
    analyzeMessageIntent,
    generateUserResponse,
    fetchUserTasks,
    addTask,
    removeTask
  };
}

module.exports = setupOpenAIService;