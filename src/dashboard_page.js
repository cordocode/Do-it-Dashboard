// dashboard_page.js

import React, { useState, useEffect, useCallback } from "react";
import { Box, ProfileButton } from "./components";
import { useNavigate } from "react-router-dom";
import './css/global.css';
import './css/landing_page.css';
import './css/profile_page.css';
import './css/the_box.css';
import './css/time.css';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com';

function DashboardPage({ user, setUser }) {
  const [displayName, setDisplayName] = useState(''); // Name from the DB
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userDbTimeZone, setUserDbTimeZone] = useState('UTC');
  const navigate = useNavigate();

  // Memoize updateUserTimeZone to fix dependency issue
  const updateUserTimeZone = useCallback((timeZone) => {
    fetch(`${API_BASE_URL}/api/user-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user?.sub || user?.email,
        timeZone: timeZone
      })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) {
        console.error('Failed to update timezone:', data.error);
      }
    })
    .catch(err => console.error('Error updating timezone:', err));
  }, [user]);

  // Fetch user profile and timezone first, then fetch boxes
  useEffect(() => {
    if (user) {
      fetch(`${API_BASE_URL}/api/user-profile?userId=${user.sub}&email=${user.email}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const profile = data.profile;
            setDisplayName(profile.first_name || 'friend');
            
            // Store timezone in state, with a fallback
            const detectedTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const tzToUse = profile.time_zone || detectedTimeZone || 'UTC';
            setUserDbTimeZone(tzToUse);
            
            // If there was no timezone, update it
            if (!profile.time_zone) {
              updateUserTimeZone(tzToUse);
            }
            
            // Now that we have the timezone, fetch boxes
            fetchBoxes(user.sub || user.email);
          } else {
            setLoading(false);
          }
        })
        .catch(err => {
          console.error('Error fetching user profile:', err);
          setLoading(false);
          // Set a default timezone if there was an error
          setUserDbTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
        });
    }
  }, [user, updateUserTimeZone]); // Fixed dependency array

  // Fetch boxes
  const fetchBoxes = (userId) => {
    setLoading(true);
    fetch(`${API_BASE_URL}/api/boxes?userId=${userId}`)
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
  };

  // Add a new box
  const addBox = () => {
    setBoxes([...boxes, { id: null, content: "", time_type: "none", time_value: "" }]);
  };

  // Delete a box
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

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  // Navigate to profile page
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
        ) : boxes.length === 0 ? (
          <div style={{ margin: '40px 0', color: 'var(--text-secondary)' }}>
            No tasks yet. Add a new task to get started!
          </div>
        ) : (
          boxes.map(box => (
            <Box
              key={box.id || Math.random()}
              id={box.id}
              user={user}
              onDelete={deleteBox}
              onSave={handleBoxSave}
              initialContent={box.content}
              initialTimeType={box.time_type || "none"}
              initialTimeValue={box.time_value || ""}
              userTimeZone={userDbTimeZone}
            />
          ))
        )}
      </div>
    </>
  );
}

export default DashboardPage;