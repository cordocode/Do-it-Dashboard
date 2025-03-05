import React, { useState, useEffect } from "react";
import { Box, ProfileButton } from "./components";
import { useNavigate } from "react-router-dom";
import './components.css';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com'

function DashboardPage({ user, setUser }) {
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Extract user's first name from their full name or email
  const getUserFirstName = () => {
    if (!user) return '';
    
    // Try to get name from Google profile data
    if (user.name) {
      return user.name.split(' ')[0];
    } 
    
    // Fall back to email if name not available
    if (user.email) {
      return user.email.split('@')[0];
    }
    
    return 'friend'; // Default fallback
  };

  // Fetch existing boxes from the backend for this user
  useEffect(() => {
    if (user) {
      setLoading(true);
      fetch(`${API_BASE_URL}/api/boxes?userId=${user.sub || user.email}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setBoxes(data.boxes);
          }
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [user]);

  // Create a new box in the database (empty content)
  const addBox = () => {
    setBoxes([...boxes, { id: null, content: "" }]);
  };

  // Delete a box in the database
  const deleteBox = (boxId) => {
    // Remove from local state first
    setBoxes(boxes.filter(b => b.id !== boxId));
    
    // Only call API if the box was saved (has an ID)
    if (boxId) {
      fetch(`${API_BASE_URL}/api/boxes/${boxId}`, {
        method: 'DELETE',
      })
        .then(response => response.json())
        .then(data => {
          if (!data.success) {
            console.error('Failed to delete box from server');
          }
        })
        .catch(err => console.error(err));
    }
  };

  // Handler for when a box is saved
  const handleBoxSave = (oldId, newBox) => {
    setBoxes(boxes.map(box => 
      (box.id === oldId || (!box.id && !oldId)) ? newBox : box
    ));
  };

  // Standard logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  return (
    <>
      <div className="dashboard-header">
        <ProfileButton onLogout={handleLogout} />
      </div>
      <div className="content-container">
        <h1>Let's get 'er done, {getUserFirstName()}</h1>
        <div className="action-container">
          <button onClick={addBox}>Add New Task</button>
        </div>

        {loading ? (
          <div className="loading-spinner"></div>
        ) : (
          boxes.length === 0 ? (
            <div style={{ margin: '40px 0', color: 'var(--text-secondary)' }}>
              No tasks yet. Add a new task to get started!
            </div>
          ) : (
            boxes.map(box => (
              <Box
                key={box.id || Math.random()} // Temporary key for unsaved boxes
                id={box.id}
                user={user}
                onDelete={deleteBox}
                onSave={handleBoxSave}
                initialContent={box.content}
              />
            ))
          )
        )}
      </div>
    </>
  );
}

export default DashboardPage;