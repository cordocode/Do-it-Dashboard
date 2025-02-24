import React, { useState, useEffect } from "react";
import { Box, ProfileButton } from "./components";
import { useNavigate } from "react-router-dom";
import './components.css';


const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com'


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
            // Optionally restore the box if server delete failed
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
        <div className="action-container">
          <button onClick={addBox}>Add Box</button>
        </div>

        {boxes.map(box => (
          <Box
            key={box.id || Math.random()} // Temporary key for unsaved boxes
            id={box.id}
            user={user}
            onDelete={deleteBox}
            onSave={handleBoxSave}
            initialContent={box.content}
          />
        ))}
      </div>
    </>
  );
}

export default DashboardPage;