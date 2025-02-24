import React, { useState, useEffect } from "react";
import { Box, ProfileButton } from "./components";
import { useNavigate } from "react-router-dom";

// Base URL for all API calls
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://backend.formybuddy.com'

function DashboardPage({ user, setUser }) {
  const [boxes, setBoxes] = useState([]);
  const navigate = useNavigate();

  // Fetch existing boxes from the backend for this user
  useEffect(() => {
    if (user) {
      fetch(`${API_BASE_URL}/api/boxes?userId=${user.sub || user.email}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setBoxes(data.boxes);
          }
        })
        .catch(err => console.error(err));
    }
  }, [user]);

  // Create a new box in the database (empty content)
  const addBox = () => {
    fetch(`${API_BASE_URL}/api/boxes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.sub || user.email,
        content: ""
      })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setBoxes([...boxes, data.box]);
        }
      })
      .catch(err => console.error(err));
  };

  // Delete a box in the database
  const deleteBox = (boxId) => {
    fetch(`${API_BASE_URL}/api/boxes/${boxId}`, {
      method: 'DELETE',
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setBoxes(boxes.filter(b => b.id !== boxId));
        }
      })
      .catch(err => console.error(err));
  };

  // Standard logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
        <ProfileButton onLogout={handleLogout} />
      </div>
      
      <button onClick={addBox}>Add Box</button>

      {boxes.map(box => (
        <Box
          key={box.id}
          id={box.id}
          onDelete={deleteBox}
          initialContent={box.content}
        />
      ))}
    </div>
  );
}

export default DashboardPage;