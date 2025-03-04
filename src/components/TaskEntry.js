import React, { useState } from 'react';

const TaskEntry = ({ onTaskAdd }) => {
  const [taskTitle, setTaskTitle] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (taskTitle.trim()) {
      onTaskAdd({
        id: Date.now(),
        title: taskTitle,
        completed: false,
        createdAt: new Date()
      });
      setTaskTitle('');
    }
  };
  
  return (
    <div className="task-entry">
      <form className="task-entry-form" onSubmit={handleSubmit}>
        <div className="task-entry-main">
          <input 
            type="text" 
            className="task-entry-input" 
            placeholder="What needs to be done?" 
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">Add Task</button>
        </div>
        <div className="task-entry-options">
          <button type="button" className="btn btn-outline">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            Set due date
          </button>
          <button type="button" className="btn btn-outline">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
              <line x1="7" y1="7" x2="7.01" y2="7"></line>
            </svg>
            Add tag
          </button>
          <button type="button" className="btn btn-outline">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            Set priority
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskEntry;
