import React, { useState, useEffect } from "react";
import { Box, ProfileButton } from "./components";
import { useNavigate } from "react-router-dom";
import './components.css';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com';

function DashboardPage({ user, setUser }) {
  const [displayName, setDisplayName] = useState(''); // Name from the DB
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // 1) Fetch the user's name from the database
  useEffect(() => {
    if (user) {
      fetch(`${API_BASE_URL}/api/user-profile?userId=${user.sub || user.email}`)
        .then(response => response.json())
        .then(data => {
          if (data.success && data.profile.first_name) {
            setDisplayName(data.profile.first_name);
          } else {
            // Fallback if DB has no name
            setDisplayName('friend');
          }
        })
        .catch(err => console.error('Error fetching user name:', err));
    }
  }, [user]);

  // 2) Fetch existing boxes from the backend for this user
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
          console.error('Error fetching boxes:', err);
          setLoading(false);
        });
    }
  }, [user]);

  // 3) Create a new box in the database (empty content)
  const addBox = () => {
    setBoxes([...boxes, { id: null, content: "" }]);
  };

  // 4) Delete a box in the database
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

  // 5) Handler for when a box is saved
  const handleBoxSave = (oldId, newBox) => {
    setBoxes(boxes.map(box => 
      (box.id === oldId || (!box.id && !oldId)) ? newBox : box
    ));
  };

  // 6) Standard logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  // 7) Navigate to profile page
  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <>
      <div className="dashboard-header">
        <ProfileButton 
          onLogout={handleLogout} 
          onProfileClick={handleProfileClick}
        />
      </div>
      <div className="content-container">
        <h1>Let's get 'er done, {displayName}</h1>
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
