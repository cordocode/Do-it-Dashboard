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
- **Parameters:** `userId`, `firstName`, `timeZone` (request body)
- **Purpose:** Updates a user's first name and/or timezone
- **Frontend Usage:** Called when user saves name in profile page, or when timezone is detected automatically
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/user-profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.sub || user.email,
      firstName: firstName,
      timeZone: detectedTimeZone
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
- **Parameters:** `userId`, `content`, `time_type`, `time_value`, `reminder_offset` (request body)
- **Purpose:** Creates a new task with optional time information
- **Time Processing:**
  - Natural language time parsing (e.g., "tonight at 9")
  - Automatic PM assumption for evening times
  - UTC conversion for database storage
- **Frontend Usage:** Called when a user saves a new task in the Box component
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/boxes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId,
      content: text,
      time_type: timeType || 'none',
      time_value: timeValue === "" ? null : timeValue,
      reminder_offset: reminderOffset || 0
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
- **Parameters:** `id` (URL param), `content`, `time_type`, `time_value`, `reminder_offset`, `userId` (request body)
- **Purpose:** Updates a task's content and time settings
- **Time Processing:** Same time parsing as creation endpoint
- **Frontend Usage:** Called when a user edits an existing task in the Box component
- **Code Pattern:**
  ```javascript
  fetch(`${API_BASE_URL}/api/boxes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: text,
      time_type: timeType || 'none',
      time_value: timeValue === "" ? null : timeValue,
      reminder_offset: reminderOffset || 0,
      userId: userId
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
- **Process:** Uses OpenAI to analyze message intent and manages tasks accordingly, including time interpretation

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

# Database Structure Summary for FormyBuddy Task Management App

This document provides a comprehensive overview of the PostgreSQL database structure used by the FormyBuddy task management application. The database contains two primary tables that store user information and task data.

## Database Overview

The application uses a PostgreSQL database with two main tables:
- `users` - Stores user account information, phone verification details, and timezone preferences
- `boxes` - Stores tasks (called "boxes" in the codebase) created by users, including time-related data

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
    verification_code integer,
    time_zone text DEFAULT 'UTC'
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
- `time_zone`: User's preferred timezone (e.g., "America/Denver")

**Indexes:**
- Primary key on `id`
- Unique constraints on `user_id`, `email`, and `phone_number`

### Boxes Table (Tasks)

The `boxes` table stores the actual tasks created by users:

```sql
CREATE TABLE boxes (
    id integer NOT NULL PRIMARY KEY DEFAULT nextval('boxes_id_seq'::regclass),
    user_id character varying(255) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    content text NOT NULL,
    time_type text DEFAULT 'none',
    time_value timestamp with time zone,
    reminder_offset integer,
    reminder_sent boolean DEFAULT FALSE
);
```

**Key fields:**
- `id`: Auto-incrementing primary key
- `user_id`: Foreign key to users.user_id - identifies which user owns the task
- `content`: The actual text content of the task
- `time_type`: Indicates task timing type ("none", "scheduled", "deadline")
- `time_value`: Stores timestamps in UTC format with timezone awareness
- `reminder_offset`: Minutes before task time to send a reminder
- `reminder_sent`: Tracks if a reminder has been sent

**Constraints:**
- Primary key on `id`
- Foreign key on `user_id` referencing `users.user_id` with CASCADE delete

## Relationships

There is a one-to-many relationship between users and boxes:
- One user can have multiple tasks (boxes)
- Each task belongs to exactly one user
- When a user is deleted, all their tasks are automatically deleted (CASCADE)

## Time and Timezone Management

The database design now includes comprehensive time and timezone management:

1. **User Timezone Preferences:**
   - Each user's preferred timezone is stored in the `time_zone` field
   - This defaults to 'UTC' if not specified
   - Used for accurate time parsing and display across the application

2. **Task Time Storage:**
   - All task times are stored in UTC format in the database
   - The database uses `timestamp with time zone` to properly handle timezone information
   - This ensures consistent time representation regardless of server or client location

3. **Reminder Management:**
   - The `reminder_offset` field specifies how many minutes before the task time to send a reminder
   - The `reminder_sent` boolean tracks whether a reminder has been sent to avoid duplicates

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
   - Time-related information must be correctly interpreted in both interfaces

## Critical Application Logic

1. **Tense-Based Task Management**
   - The application uses linguistic tense analysis to determine intent
   - Past tense ("called mom") = complete/remove task
   - Present/future tense ("call mom") = add task
   - Time expressions now parsed contextually (e.g., "tonight at 9" understood as evening time)

2. **Phone Verification Flow**
   - Two-step process: send code, then verify code
   - Verification must complete before SMS functionality works
   - Code storage in `verification_code` field

3. **User Authentication & Identity**
   - Google OAuth authentication model 
   - User's Google `sub` value serves as `user_id` throughout the system
   - No traditional username/password authentication

4. **Timezone Management System**
   - Automatic timezone detection from browser
   - User timezone preferences stored in database
   - All server-client time communications in UTC format
   - Frontend converts UTC times to user's local timezone for display
   - Natural language time parsing considers user's timezone context

5. **Reminder Processing Logic**
   - Cron-based job scheduler runs every minute to check for upcoming tasks
   - Task times converted to appropriate timezone for reminder timing
   - SMS notifications sent at proper times relative to user's timezone
   - Reminder tracking to prevent duplicate notifications

## Time-Related UI Components

1. **Time Selector Modal**
   - Allows selection of time type (none, scheduled, deadline)
   - Natural language time input field
   - Converts user input to proper time representation

2. **Time Display in Tasks**
   - Shows scheduled/deadline times in user's local timezone
   - Includes timezone indicator for clarity
   - Visual differentiation between scheduled and deadline tasks

3. **Natural Language Time Processing**
   - Intelligently parses expressions like "tomorrow", "tonight", "next Tuesday"
   - Contextually understands time references (e.g., "tonight at 9" means 9 PM)
   - Resolves relative time references based on current date/time

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
   - Enhanced prompts to recognize and parse time-related information
   - Two-step process: analyze intent first, then generate response

4. **Responsive Design Considerations**
   - Application appears to be designed for both mobile and desktop
   - Any new UI elements must maintain responsiveness

## Time Processing Implementation Details

1. **Natural Language Time Parsing**
   ```javascript
   // Parse natural language time
   const nowInUserTZ = DateTime.now().setZone(userTimeZone);
   
   // Handle evening time inference
   if (/tonight at \d{1,2}(:00)?$/.test(time_value)) {
     const hourMatch = time_value.match(/\d{1,2}/);
     if (hourMatch && parseInt(hourMatch[0]) < 12) {
       timeString = time_value.replace(/at (\d{1,2})/, 'at $1pm');
     }
   }
   
   // Parse with user's timezone as reference
   const parsedResults = chrono.parse(timeString, nowInUserTZ.toJSDate(), { forwardDate: true });
   
   // Convert to proper UTC format for storage
   parsedTimestamp = userLocalDate.toISOString();
   ```

2. **Frontend Time Display**
   ```javascript
   // Convert UTC database time to user's local timezone
   const renderTimeDisplay = () => {
     if (!timeValue || timeType === "none") return null;
     
     // Get the user's timezone with fallbacks
     const userTz = userTimeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
     
     // Format the date in the user's timezone
     const options = { 
       year: 'numeric', 
       month: 'short', 
       day: 'numeric', 
       hour: 'numeric', 
       minute: '2-digit',
       timeZone: userTz,
       hour12: true
     };
     
     const formatter = new Intl.DateTimeFormat('en-US', options);
     const localTimeDisplay = formatter.format(new Date(timeValue));
     
     return (
       <div className="time-display">
         {timeType === "deadline" ? "Due: " : "Scheduled: "}
         {localTimeDisplay}
         <div className="timezone-info">({userTz})</div>
       </div>
     );
   };
   ```

## Current Limitations and Future Work

1. **Recurring Tasks**
   - The system still lacks support for recurring tasks
   - Would require additional database fields and scheduler logic

2. **Calendar Integration**
   - No integration with external calendar systems (Google Calendar, etc.)
   - Could enhance the application with import/export capabilities

3. **Time Range Tasks**
   - Current system only supports point-in-time tasks
   - Future enhancement could add start/end times for duration-based tasks

4. **Reminder Customization**
   - Limited reminder configuration (currently fixed minutes-before format)
   - Could be enhanced with multiple reminders and custom messaging

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
- **Time Processing**: Parses natural language time expressions and manages timezone conversions
- **Service Integration**: Incorporates the Twilio service for SMS functionality
- **Error Handling**: Manages error responses across API endpoints

This file acts as the central hub of the backend, coordinating between the database, external services, and HTTP requests. The enhanced time-related functionality includes natural language time parsing, timezone inference, and proper UTC conversion.

### openAIservice.js

This service manages all natural language processing and AI-powered task management through:

- **Message Intent Analysis**: Uses OpenAI to determine what a user wants to do based on their SMS message
- **Tense Detection**: Analyzes linguistic tense to distinguish between adding and completing tasks
- **Time Expression Extraction**: Identifies and separates time phrases from task content
- **Task Operations**: Provides functions for adding, removing, and updating tasks with time information
- **Response Generation**: Creates friendly, conversational responses for users
- **Task Matching**: Implements sophisticated algorithms to identify which task a user refers to
- **Context Handling**: Provides task context to OpenAI for better understanding
- **Timezone Integration**: Ensures time references respect user's timezone preference

This file is critical for SMS-based task management. It now includes enhanced prompts and processing to handle time information in natural language messages.

### twilioservice.js

This service manages all SMS and phone verification functionality:

- **Phone Verification**: Implements the two-step verification process (send code, verify code)
- **SMS Webhook Handling**: Processes incoming SMS messages from users
- **Message Routing**: Directs SMS messages to the OpenAI service for processing
- **Response Generation**: Formats and sends SMS responses back to users
- **Twilio Integration**: Configures and manages the Twilio client connection
- **Testing Routes**: Provides endpoints for testing SMS functionality without actual Twilio calls

This service now works with the enhanced OpenAI service to properly handle time-related SMS commands.

### reminder_scheduler.js

This new component manages scheduled task reminders:

- **Cron Scheduling**: Runs periodic checks for upcoming tasks
- **Time Parsing**: Ensures task times are properly interpreted
- **Timezone Awareness**: Adjusts reminder timing based on user's timezone
- **SMS Notifications**: Sends reminders via Twilio
- **Reminder Tracking**: Prevents duplicate notifications

This file implements the background processes needed for time-based task management.

## Frontend Files

### components.js

This file contains reusable UI components used throughout the application:

- **Box Component**: The primary task component with edit, save, and delete functionality
- **Time Display**: Renders task times in the user's local timezone
- **Time Selector Modal**: Provides interface for selecting task timing options
- **GoogleLoginButton**: Handles authentication UI
- **ConfirmationPopup**: Provides confirmation dialogs for actions like deletion
- **StatusIndicator**: Shows task status (unsaved, modified, saved)
- **ProfileButton**: Manages user profile menu and logout functionality

The Box component has been significantly enhanced to support time-based task management, including a new TimeModal component and timezone-aware time display.

### dashboard_page.js

This is the main task management interface for users:

- **Task Display**: Lists and renders all user tasks
- **Task Operations**: Manages adding, deleting, and updating tasks
- **Time Management**: Handles timezone detection and user preferences
- **API Integration**: Communicates with backend endpoints for task operations
- **Real-time Updates**: Implements polling for fresh task data
- **UI State Management**: Tracks editing states, task deletion, and other UI states
- **Navigation**: Provides access to profile and logout functionality

This file now includes timezone detection and management to ensure consistent time handling throughout the application.

### profile_page.js

This file manages user profile information and phone verification:

- **Profile Display**: Shows and allows editing of user information
- **Name Management**: Handles updating the user's display name
- **Phone Verification**: Implements the UI for the phone verification process
- **API Integration**: Communicates with backend endpoints for profile operations
- **Timezone Management**: Could be extended to allow manual timezone selection
- **Error Handling**: Manages and displays verification errors
- **Navigation**: Provides ways to return to the dashboard