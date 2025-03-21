# Backend API Endpoints and Frontend Integration in FormyBuddy Task Management App

This document outlines all backend API endpoints in the FormyBuddy application and how they are accessed by the frontend components. The application uses a Node.js/Express backend with a PostgreSQL database and integrates with Twilio for SMS notifications and OpenAI for natural language processing.

## API Base URL Configuration

The application uses environment-based API URL configuration. All frontend components access the API through this base URL:

```javascript
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080'
  : 'https://backend.formybuddy.com';
```

## User Management Endpoints

### 1. Get/Create User Profile
- **Endpoint:** `GET /api/user-profile`
- **Parameters:** `userId`, `email` (query params)
- **Purpose:** Retrieves user profile; creates new user if not found
- **Frontend Usage:** Called when profile page or dashboard loads
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/user-profile?userId=${user.sub}&email=${user.email}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Process user profile data
      }
    })
  ```

### 2. Update User Profile
- **Endpoint:** `PUT /api/user-profile`
- **Parameters:** `userId`, `firstName` (request body)
- **Purpose:** Updates a user's first name
- **Frontend Usage:** Called when user saves name in profile page
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/user-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.sub || user.email,
      firstName: firstName
    })
  })
  ```

### 3. Find User by Phone
- **Endpoint:** `GET /api/user-by-phone`
- **Parameters:** `phone` (query param)
- **Purpose:** Looks up user by verified phone number
- **Frontend Usage:** Not directly used by frontend; called by backend for SMS processing
- **Note:** Used for identifying users from their phone numbers during SMS processing

## Task Management Endpoints

### 1. Create Task
- **Endpoint:** `POST /api/boxes`
- **Parameters:** `userId`, `content` (request body)
- **Purpose:** Creates a new task
- **Frontend Usage:** Called when a user saves a new task in the Box component
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/boxes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      content: text
    })
  })
  ```

### 2. Get User Tasks
- **Endpoint:** `GET /api/boxes`
- **Parameters:** `userId` (query param)
- **Purpose:** Retrieves all tasks for a specific user
- **Frontend Usage:** Polled regularly in dashboard to display and refresh tasks
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/boxes?userId=${user.sub || user.email}`)
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setBoxes(data.boxes);
      }
    })
  ```

### 3. Update Task
- **Endpoint:** `PUT /api/boxes/:id`
- **Parameters:** `id` (URL param), `content` (request body)
- **Purpose:** Updates a task's content
- **Frontend Usage:** Called when a user edits an existing task in the Box component
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/boxes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: text
    })
  })
  ```

### 4. Delete Task
- **Endpoint:** `DELETE /api/boxes/:id`
- **Parameters:** `id` (URL param)
- **Purpose:** Deletes a specific task
- **Frontend Usage:** Called when a user confirms deletion of a task
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/boxes/${id}`, {
    method: 'DELETE'
  })
  ```

## Phone Verification Endpoints

### 1. Send Verification Code
- **Endpoint:** `POST /api/send-verification-code`
- **Parameters:** `userId`, `phoneNumber` (request body)
- **Purpose:** Sends a 6-digit verification code via SMS
- **Frontend Usage:** Called when user submits phone number for verification
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/send-verification-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      phoneNumber: phoneInput.replace(/\s+/g, '')
    })
  })
  ```

### 2. Verify Phone
- **Endpoint:** `POST /api/verify-phone`
- **Parameters:** `userId`, `code`, `phoneNumber` (request body)
- **Purpose:** Verifies phone with submitted code
- **Frontend Usage:** Called when user submits verification code
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/verify-phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: userId,
      code: verificationCode,
      phoneNumber: phoneInput.replace(/\s+/g, '')
    })
  })
  ```

## SMS Integration Endpoints

### 1. SMS Webhook
- **Endpoint:** `POST /twilio/webhook`
- **Parameters:** Twilio SMS payload
- **Purpose:** Handles incoming SMS messages from users
- **Frontend Usage:** Not called by frontend; invoked by Twilio when SMS is received
- **Process:** Uses OpenAI to analyze message intent and manages tasks accordingly

### 2. Test SMS Processing
- **Endpoint:** `POST /api/test-sms-processing`
- **Parameters:** `message`, `phoneNumber` (request body)
- **Purpose:** Testing endpoint for SMS processing without Twilio
- **Frontend Usage:** Development/testing only, not used in production frontend

## Utility Endpoints

### 1. Database Test
- **Endpoint:** `GET /db-test`
- **Parameters:** None
- **Purpose:** Tests database connection
- **Frontend Usage:** Not used by frontend; utility endpoint

### 2. Root Route
- **Endpoint:** `GET /`
- **Parameters:** None
- **Purpose:** Basic healthcheck
- **Frontend Usage:** Not used by frontend
- **Response:** "Server is running!"

## Important Notes

1. The application uses a polling strategy to fetch updated tasks, with requests made every 5 seconds.

2. Task creation in the frontend first creates a temporary ID (`temp-${Date.now()}`) before saving to backend.

3. The OpenAI service analyzes SMS messages to determine user intent (add, remove, update, or list tasks).

4. The app currently doesn't have time-related task functionality, which would require modifications to task endpoints and database schema.

5. All endpoints return responses with a standard pattern: `{ success: true/false, [data] }`.

# Database Structure Summary for FormyBuddy Task Management App

This document provides a comprehensive overview of the PostgreSQL database structure used by the FormyBuddy task management application. The database contains two primary tables that store user information and task data.

## Database Overview

The application uses a PostgreSQL database with two main tables:
- `users` - Stores user account information and phone verification details
- `boxes` - Stores tasks (called "boxes" in the codebase) created by users

Current row counts:
- Users: 6 rows
- Tasks (boxes): 20 rows

## Table Structures

### Users Table

The `users` table stores all user-related information:

```sql
CREATE TABLE users (
    id integer NOT NULL PRIMARY KEY DEFAULT nextval('users_id_seq'::regclass),
    user_id character varying(255) NOT NULL UNIQUE,
    first_name text,
    email text UNIQUE,
    phone_number text UNIQUE,
    phone_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    verification_code integer
);
```

**Key fields:**
- `id`: Internal auto-incrementing primary key
- `user_id`: External identifier (likely from Google OAuth), used for linking tasks
- `first_name`: User's display name (nullable)
- `email`: User's email address (nullable, but has unique constraint)
- `phone_number`: For SMS notifications (nullable, but has unique constraint)
- `phone_verified`: Boolean flag indicating if phone has been verified
- `verification_code`: Temporary code for phone verification process
- `created_at`: Timestamp of account creation

**Indexes:**
- Primary key on `id`
- Unique constraints on `user_id`, `email`, and `phone_number`

### Boxes Table (Tasks)

The `boxes` table stores the actual tasks created by users:

```sql
CREATE TABLE boxes (
    id integer NOT NULL PRIMARY KEY DEFAULT nextval('boxes_id_seq'::regclass),
    user_id character varying(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content text NOT NULL
);
```

**Key fields:**
- `id`: Auto-incrementing primary key
- `user_id`: Foreign key to users.user_id - identifies which user owns the task
- `content`: The actual text content of the task

**Constraints:**
- Primary key on `id`
- Foreign key on `user_id` referencing `users.user_id` with CASCADE delete

## Relationships

There is a one-to-many relationship between users and boxes:
- One user can have multiple tasks (boxes)
- Each task belongs to exactly one user
- When a user is deleted, all their tasks are automatically deleted (CASCADE)

## Current Limitations

The database schema currently lacks time-related fields for tasks. To implement scheduled, deadline, and recurring tasks, the database would need to be modified to include additional columns such as:
- `task_type` (to distinguish between standard, scheduled, deadline, and recurring tasks)
- `start_datetime` (for scheduled tasks)
- `end_datetime` (for deadline tasks)
- `recurrence_pattern` (for recurring tasks)

## Integration with Backend

The Node.js backend interacts with this database primarily through the following operations:
- Creating new users during authentication
- Adding, retrieving, updating, and deleting tasks
- Storing and checking phone verification codes
- Looking up users by phone number for SMS integration

All database operations are performed using parameterized queries to prevent SQL injection, and the schema includes appropriate constraints to maintain data integrity.

# Critical Context for Feature Integration in FormyBuddy Task Management App

Beyond the endpoints and database structure, here are the essential contextual elements any AI would need to understand to successfully integrate new features:

## Architectural Patterns & Data Flow

1. **Single Page Application Architecture**
   - React frontend with client-side routing
   - State management primarily through React's useState/useEffect
   - Temporary IDs (`temp-${Date.now()}`) used before backend persistence

2. **SMS-Web Dual Interface Model**
   - All tasks can be managed through both web UI and SMS
   - Any new feature must work seamlessly through both interfaces
   - SMS commands are processed via OpenAI's natural language understanding

## Critical Application Logic

1. **Tense-Based Task Management**
   - The application uses linguistic tense analysis to determine intent
   - Past tense ("called mom") = complete/remove task
   - Present/future tense ("call mom") = add task
   - This pattern would need extension for time-based features

2. **Phone Verification Flow**
   - Two-step process: send code, then verify code
   - Verification must complete before SMS functionality works
   - Code storage in `verification_code` field

3. **User Authentication & Identity**
   - Google OAuth authentication model 
   - User's Google `sub` value serves as `user_id` throughout the system
   - No traditional username/password authentication

## Technical Constraints & Considerations

1. **UI Philosophy**
   - Emphasis on simplicity and minimal UI
   - New features must maintain clean, uncluttered interface
   - Component reusability pattern (Box component for tasks)

2. **Environment Configuration**
   - Development vs. production environment switching
   - API base URL changes based on environment
   - Sensitive keys stored in environment variables

3. **OpenAI Integration Approach**
   - Function calling pattern with structured parameters
   - System prompts that define expected analysis patterns
   - Two-step process: analyze intent first, then generate response

4. **Responsive Design Considerations**
   - Application appears to be designed for both mobile and desktop
   - Any new UI elements must maintain responsiveness

## Current Limitations

1. **Scheduler Absence**
   - No mechanism for running scheduled tasks (would need for recurring tasks)
   - No background job processing system

2. **Database Schema Constraints**
   - No time-related fields currently in boxes table
   - No task type differentiation

3. **Data Validation**
   - Limited validation of time inputs would need enhancement
   - No timezone handling apparent in current code

## AWS Infrastructure

1. **Deployment Environment**
   - Running on Amazon Linux in EC2
   - PostgreSQL database on Amazon RDS
   - Understanding of AWS services critical for any infrastructure changes

2. **Connection Security**
   - SSL used for database connection
   - Understanding of security considerations for time-based notifications

# Detailed File-by-File Architecture of FormyBuddy Task Management App

Understanding where each piece of functionality lives in the codebase is crucial for integrating new features. Here's a comprehensive breakdown of each file's responsibilities in the FormyBuddy application:

## Backend Files

### server.js

This is the main entry point for the Node.js/Express backend application. It handles:

- **Server Initialization**: Configures Express, middleware, and database connections
- **Database Configuration**: Sets up the PostgreSQL connection pool with appropriate SSL settings
- **Core API Routes**: Defines and implements the primary API endpoints
- **User Management**: Handles user profile retrieval, creation, and updates
- **Task (Box) Operations**: Implements CRUD functionality for tasks
- **Service Integration**: Incorporates the Twilio service for SMS functionality
- **Error Handling**: Manages error responses across API endpoints

This file acts as the central hub of the backend, coordinating between the database, external services, and HTTP requests. Any new feature would likely require modifications here to add new API endpoints or extend existing ones.

### openAIservice.js

This service manages all natural language processing and AI-powered task management through:

- **Message Intent Analysis**: Uses OpenAI to determine what a user wants to do based on their SMS message
- **Tense Detection**: Analyzes linguistic tense to distinguish between adding and completing tasks
- **Task Operations**: Provides functions for adding, removing, and updating tasks
- **Response Generation**: Creates friendly, conversational responses for users
- **Task Matching**: Implements sophisticated algorithms to identify which task a user refers to
- **Context Handling**: Provides task context to OpenAI for better understanding

This file is critical for any feature that must work through SMS. New time-based task features would require updates to the intent analysis system, OpenAI prompts, and function parameters to recognize and process time-related information.

### twilioservice.js

This service manages all SMS and phone verification functionality:

- **Phone Verification**: Implements the two-step verification process (send code, verify code)
- **SMS Webhook Handling**: Processes incoming SMS messages from users
- **Message Routing**: Directs SMS messages to the OpenAI service for processing
- **Response Generation**: Formats and sends SMS responses back to users
- **Twilio Integration**: Configures and manages the Twilio client connection
- **Testing Routes**: Provides endpoints for testing SMS functionality without actual Twilio calls

Any feature requiring notifications, reminders, or SMS commands would need modifications here. Time-based tasks would need enhancements to the SMS processing and possibly new notification features.

## Frontend Files

### index.js

This is the entry point for the React application:

- **React Initialization**: Sets up the React root and renders the main application component
- **Application Bootstrap**: Mounts the NavigatePages component, which handles routing

This file typically wouldn't need modification for new features, as it delegates to NavigatePages.

### navigate_pages.js

This file handles application routing and user session management:

- **Route Configuration**: Defines routes for login, dashboard, and profile pages
- **Authentication State**: Manages user login state and persistence
- **Protected Routes**: Implements route protection based on authentication status
- **Loading States**: Manages application loading indicators

New features requiring additional pages would need route definitions here. Time-based tasks likely wouldn't require new routes, but might need modifications to the authentication state management.

### login_page.js

This file manages user authentication and the application's entry point:

- **Google OAuth Integration**: Implements Google login functionality
- **User Onboarding**: Provides initial instructions through an animated typewriter effect
- **Token Handling**: Processes the authentication token and extracts user information
- **Navigation**: Redirects to the dashboard upon successful authentication
- **Error Handling**: Manages authentication failures

Time-based task features wouldn't typically require changes here unless they affected the onboarding experience.

### dashboard_page.js

This is the main task management interface for users:

- **Task Display**: Lists and renders all user tasks
- **Task Operations**: Manages adding, deleting, and updating tasks
- **API Integration**: Communicates with backend endpoints for task operations
- **Real-time Updates**: Implements polling for fresh task data
- **UI State Management**: Tracks editing states, task deletion, and other UI states
- **Navigation**: Provides access to profile and logout functionality

This file would need significant modifications for time-based tasks, including UI elements for displaying and editing time information, potentially new filtering options, and handling of different task types.

### profile_page.js

This file manages user profile information and phone verification:

- **Profile Display**: Shows and allows editing of user information
- **Name Management**: Handles updating the user's display name
- **Phone Verification**: Implements the UI for the phone verification process
- **API Integration**: Communicates with backend endpoints for profile operations
- **Error Handling**: Manages and displays verification errors
- **Navigation**: Provides ways to return to the dashboard

Time-based notification features might require enhancements to the profile page, such as notification preferences.

### components.js

This file contains reusable UI components used throughout the application:

- **Box Component**: The primary task component with edit, save, and delete functionality
- **GoogleLoginButton**: Handles authentication UI
- **ConfirmationPopup**: Provides confirmation dialogs for actions like deletion
- **StatusIndicator**: Shows task status (unsaved, modified, saved)
- **ProfileButton**: Manages user profile menu and logout functionality

The Box component would need significant modifications to display and manage time information for tasks. New components might be needed for time selection, recurrence pattern configuration, and task type indication.

