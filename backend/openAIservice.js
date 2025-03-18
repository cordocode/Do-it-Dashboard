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
   * Analyzes user message to determine intent with enhanced tense awareness
   * @param {string} message - The user's SMS message
   * @param {string} userId - The user's ID in the system
   * @returns {Promise<Object>} - The parsed intent and relevant data
   */
  async function analyzeMessageIntent(message, userId) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // Upgraded to GPT-4
        messages: [
          { 
            role: "system", 
            content: `You are a friendly task manager assistant that helps users manage their tasks via SMS.

Important: Pay careful attention to the TENSE of the user's message:
- If they use PAST TENSE (e.g., "called mom", "finished report", "went to store"), interpret this as a completed task that should be REMOVED.
- If they use FUTURE or PRESENT TENSE ("call mom", "finish report", "need to go to store"), interpret this as a task to ADD.

Identify if the user is trying to:
1. Add a task (present/future tense statements or explicit "add" commands)
2. Remove a task (past tense statements or explicit "remove" commands)
3. Update a task (explicit requests to change/modify existing tasks)
4. List tasks (requests to see current tasks)
5. Ask for general help

Be very attentive to linguistic cues that indicate the task is already completed and should be removed.`
          },
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
                  enum: ["add_task", "remove_task", "update_task", "list_tasks", "get_help", "unknown"],
                  description: "The detected intent of the user's message"
                },
                task_content: {
                  type: "string",
                  description: "The content of the task if the intent is to add a task. For past tense (completed) tasks, this should be the normalized present tense version."
                },
                task_identifier: {
                  type: "string",
                  description: "An identifier for which task to remove/update (may be a number, keyword, or partial description)"
                },
                updated_content: {
                  type: "string",
                  description: "The new content for the task if the intent is to update a task"
                },
                tense_used: {
                  type: "string",
                  enum: ["past", "present", "future", "unclear"],
                  description: "The tense the user employed in their message"
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
   * Generates a friendly response to the user based on the detected intent
   * @param {Object} intentData - The intent data from analyzeMessageIntent
   * @returns {Promise<string>} - The response message to send to the user
   */
  async function generateUserResponse(intentData, userId = null) {
    try {
      let systemPrompt = `You are a warm, friendly task manager assistant responding via SMS. Use a conversational, upbeat tone with occasional emoji to add personality. Keep responses brief but make them feel personal and engaging.

Your goal is to make the user feel like they're texting with a helpful friend rather than a computer system. Acknowledge their requests in a natural way.`;
      
      // Add context about existing tasks if we're removing tasks
      let userTasksContext = "";
      if ((intentData.intent === "remove_task" || intentData.intent === "update_task") && userId) {
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
        model: "gpt-4o", // Upgraded to GPT-4
        messages: [
          { 
            role: "system", 
            content: systemPrompt
          },
          { 
            role: "user", 
            content: userTasksContext + `Generate a response for a user with intent: ${intentData.intent}` +
              (intentData.task_content ? `, task content: ${intentData.task_content}` : '') +
              (intentData.task_identifier ? `, task identifier: ${intentData.task_identifier}` : '') +
              (intentData.updated_content ? `, updated content: ${intentData.updated_content}` : '') +
              (intentData.tense_used ? `, tense used: ${intentData.tense_used}` : '')
          }
        ]
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('Error generating response:', error);
      return "I'm having trouble right now. Could you try again in a moment? 🙏";
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
   * Enhanced function to handle task removal intent with better context and friendly responses
   * @param {string} message - The user's SMS message
   * @param {string} userId - The user's ID in the system
   * @returns {Promise<Object>} - The result of the operation
   */
  async function handleRemoveTaskIntent(message, userId) {
    try {
      // First get all user tasks
      const tasks = await fetchUserTasks(userId);
      
      if (tasks.length === 0) {
        return { 
          success: false, 
          message: "You don't have any tasks yet! Just text me what you need to do and I'll keep track of it for you. 📝"
        };
      }
      
      // Format tasks for the AI context
      const tasksList = tasks.map((task, index) => 
        `${index + 1}. ${task.content}`
      ).join('\n');
      
      // Second OpenAI call with full context of tasks
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // Upgraded to GPT-4
        messages: [
          { 
            role: "system", 
            content: `You are a helpful task manager assistant that identifies which task a user wants to remove or mark as completed.

The user has the following tasks:
${tasksList}

Your job is to determine which task the user wants to remove based on their message.
- Pay careful attention to the context and any descriptions they provide
- If they're using past tense ("called mom", "finished report"), they likely completed a task that matches a current one
- If it's ambiguous which task they mean, identify the possible matches and explain your uncertainty
- If you can confidently determine which task, identify its number (1-based index)`
          },
          { role: "user", content: message }
        ],
        functions: [
          {
            name: "identify_task_to_remove",
            description: "Identify which task the user wants to remove",
            parameters: {
              type: "object",
              properties: {
                confidence: {
                  type: "string",
                  enum: ["high", "low", "none"],
                  description: "How confident you are in identifying the task"
                },
                task_index: {
                  type: "integer",
                  description: "The 1-based index of the task to remove (if confidence is high)"
                },
                possible_matches: {
                  type: "array",
                  items: {
                    type: "integer"
                  },
                  description: "Array of 1-based indices of possible matching tasks (if confidence is low)"
                },
                completion_language: {
                  type: "string",
                  description: "A brief, friendly phrase to acknowledge task completion (e.g., 'Great job!', 'Nicely done!')"
                },
                explanation: {
                  type: "string",
                  description: "Explanation for why these tasks were selected or why no match was found"
                }
              },
              required: ["confidence"]
            }
          }
        ],
        function_call: { name: "identify_task_to_remove" }
      });

      const result = JSON.parse(
        completion.choices[0].message.function_call.arguments
      );
      
      // Take action based on confidence
      if (result.confidence === "high" && result.task_index) {
        const taskIndex = result.task_index - 1; // Convert to 0-based
        if (taskIndex >= 0 && taskIndex < tasks.length) {
          const taskToRemove = tasks[taskIndex];
          
          // Remove the task
          const response = await axios.delete(`${API_BASE_URL}/api/boxes/${taskToRemove.id}`);
          
          if (response.data.success) {
            const completionPhrase = result.completion_language || "Got it!";
            return { 
              success: true, 
              removedTask: taskToRemove,
              message: `${completionPhrase} ✅ Removed "${taskToRemove.content}" from your list.`
            };
          } else {
            throw new Error('Failed to remove task from database');
          }
        }
      } else if (result.confidence === "low" && result.possible_matches) {
        // Provide options for ambiguous matches
        const matchedTasks = result.possible_matches
          .filter(idx => idx > 0 && idx <= tasks.length)
          .map(idx => ({ 
            index: idx, 
            task: tasks[idx-1] 
          }));
        
        if (matchedTasks.length > 0) {
          const options = matchedTasks.map(match => 
            `${match.index}. ${match.task.content}`
          ).join('\n');
          
          return {
            success: false,
            ambiguous: true,
            message: `I found a few possible matches. Which one did you complete?\n\n${options}\n\nJust reply with the number or give me more details. 👍`,
            matchedTasks
          };
        }
      }
      
      // If we get here, no task was found
      return {
        success: false,
        message: `I couldn't find a matching task on your list. Here are your current tasks:\n\n${tasksList}\n\nWhich one did you complete? You can reply with the number or description. 😊`,
        tasks
      };
      
    } catch (error) {
      console.error('Error handling remove task intent:', error);
      return { 
        success: false, 
        error: error.message,
        message: "Oops! Something went wrong while trying to update your tasks. Could you try again? 🙏"
      };
    }
  }

  /**
   * Removes a task by finding the best match to the user's description
   * (Legacy method - handleRemoveTaskIntent is preferred)
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
   * Enhanced function to handle task update intent with better context and friendly responses
   * @param {string} message - The user's SMS message
   * @param {string} userId - The user's ID in the system
   * @returns {Promise<Object>} - The result of the operation
   */
  async function handleUpdateTaskIntent(message, userId) {
    try {
      // First get all user tasks
      const tasks = await fetchUserTasks(userId);
      
      if (tasks.length === 0) {
        return { 
          success: false, 
          message: "You don't have any tasks to update yet! Text me something you need to do and I'll add it to your list. 📝"
        };
      }
      
      // Format tasks for the AI context
      const tasksList = tasks.map((task, index) => 
        `${index + 1}. ${task.content}`
      ).join('\n');
      
      // Second OpenAI call with full context of tasks
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // Upgraded to GPT-4
        messages: [
          { 
            role: "system", 
            content: `You are a friendly task manager assistant that helps users update their tasks.

The user has the following tasks:
${tasksList}

Your job is to determine which task the user wants to update based on their message,
and what the new content should be. Be warm and conversational in your analysis.` 
          },
          { role: "user", content: message }
        ],
        functions: [
          {
            name: "identify_task_update",
            description: "Identify which task to update and the new content",
            parameters: {
              type: "object",
              properties: {
                confidence: {
                  type: "string",
                  enum: ["high", "low", "none"],
                  description: "How confident you are in identifying the task"
                },
                task_index: {
                  type: "integer",
                  description: "The 1-based index of the task to update (if confidence is high)"
                },
                possible_matches: {
                  type: "array",
                  items: {
                    type: "integer"
                  },
                  description: "Array of 1-based indices of possible matching tasks (if confidence is low)"
                },
                new_content: {
                  type: "string",
                  description: "The new content for the task"
                },
                explanation: {
                  type: "string",
                  description: "Explanation for the update or why no match was found"
                }
              },
              required: ["confidence"]
            }
          }
        ],
        function_call: { name: "identify_task_update" }
      });

      const result = JSON.parse(
        completion.choices[0].message.function_call.arguments
      );
      
      // Take action based on confidence
      if (result.confidence === "high" && result.task_index && result.new_content) {
        const taskIndex = result.task_index - 1; // Convert to 0-based
        if (taskIndex >= 0 && taskIndex < tasks.length) {
          const taskToUpdate = tasks[taskIndex];
          
          // Update the task
          const response = await axios.put(`${API_BASE_URL}/api/boxes/${taskToUpdate.id}`, {
            content: result.new_content
          });
          
          if (response.data.success) {
            return { 
              success: true, 
              oldTask: taskToUpdate,
              updatedTask: response.data.box,
              message: `✏️ Updated task from:\n"${taskToUpdate.content}"\n\nto:\n"${result.new_content}"\n\nGot it! 👍`
            };
          } else {
            throw new Error('Failed to update task in database');
          }
        }
      } else if (result.confidence === "low" && result.possible_matches) {
        // Provide options for ambiguous matches
        const matchedTasks = result.possible_matches
          .filter(idx => idx > 0 && idx <= tasks.length)
          .map(idx => ({ 
            index: idx, 
            task: tasks[idx-1] 
          }));
        
        if (matchedTasks.length > 0) {
          const options = matchedTasks.map(match => 
            `${match.index}. ${match.task.content}`
          ).join('\n');
          
          return {
            success: false,
            ambiguous: true,
            message: `I'm not sure which task you want to update. Is it one of these?\n\n${options}\n\nJust reply with the number. 😊`,
            matchedTasks,
            new_content: result.new_content
          };
        }
      }
      
      // If we get here, no task was found or there was another issue
      return {
        success: false,
        message: `I'm not sure which task you want to update. Here's your current list:\n\n${tasksList}\n\nCould you tell me which one you'd like to change? You can use the number or describe it. 📝`,
        tasks
      };
      
    } catch (error) {
      console.error('Error handling update task intent:', error);
      return { 
        success: false, 
        error: error.message,
        message: "Oops! I ran into a problem while updating your task. Could you try again? 🙏"
      };
    }
  }

  /**
   * Updates an existing task for the user
   * (Legacy method - handleUpdateTaskIntent is preferred)
   * @param {string} userId - The user's ID
   * @param {string} taskIdentifier - Description or identifier for the task
   * @param {string} newContent - The new content for the task
   * @returns {Promise<Object>} - Result of the operation
   */
  async function updateTask(userId, taskIdentifier, newContent) {
    try {
      // First get all user tasks
      const tasks = await fetchUserTasks(userId);
      
      if (tasks.length === 0) {
        return { success: false, error: 'No tasks found' };
      }

      // Try to identify which task to update
      let taskToUpdate = null;
      const taskIndex = parseInt(taskIdentifier) - 1; // Convert to 0-based index
      
      if (!isNaN(taskIndex) && taskIndex >= 0 && taskIndex < tasks.length) {
        // User specified task by number
        taskToUpdate = tasks[taskIndex];
      } else {
        // Try to find by content similarity
        taskToUpdate = tasks.find(task => 
          task.content.toLowerCase().includes(taskIdentifier.toLowerCase())
        );
      }

      if (!taskToUpdate) {
        return { 
          success: false, 
          error: 'Could not identify which task to update',
          tasks // Return tasks so we can show options to the user
        };
      }

      // Update the identified task
      const response = await axios.put(`${API_BASE_URL}/api/boxes/${taskToUpdate.id}`, {
        content: newContent
      });
      
      if (response.data.success) {
        return { 
          success: true, 
          oldTask: taskToUpdate,
          updatedTask: response.data.box
        };
      }
      
      throw new Error('Failed to update task');
    } catch (error) {
      console.error('Error updating task:', error);
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
          responseText: "Hi there! 👋 It looks like your number isn't connected to an account yet. Sign up at formybuddy.com to get started!"
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
          // Use the enhanced remove task handler
          actionResult = await handleRemoveTaskIntent(message, user.user_id);
          break;
          
        case 'update_task':
          // Use the enhanced update task handler
          actionResult = await handleUpdateTaskIntent(message, user.user_id);
          break;
          
        case 'list_tasks':
          const tasks = await fetchUserTasks(user.user_id);
          actionResult = { success: true, tasks };
          break;
      }

      // 4. Generate a response to the user
      let responseText;
      
      // For remove_task and update_task intents, use the message from the actionResult
      if ((intentData.intent === 'remove_task' || intentData.intent === 'update_task') && actionResult?.message) {
        responseText = actionResult.message;
      } else {
        // For other intents, generate a response using OpenAI
        responseText = await generateUserResponse(intentData, user.user_id);
        
        // Enhance response with task list if necessary
        if (intentData.intent === 'list_tasks' && actionResult?.tasks) {
          if (actionResult.tasks.length === 0) {
            responseText += "\n\nYou don't have any tasks yet! Just text me what you need to do and I'll keep track of it for you. 📝";
          } else {
            const taskList = actionResult.tasks
              .map((task, index) => `${index + 1}. ${task.content}`)
              .join('\n');
            
            responseText += `\n\nHere's your current list:\n${taskList}`;
          }
        }
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
        responseText: "Uh-oh! 😅 I'm having a little trouble right now. Could you try again in a moment?",
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
    removeTask,
    updateTask,
    handleRemoveTaskIntent,
    handleUpdateTaskIntent
  };
}

module.exports = setupOpenAIService;