import React, { useState } from "react";
import { Box, ProfileButton } from "./components";
import { useNavigate } from "react-router-dom";
import './components.css';

function DashboardPage({ user, setUser }) {
  const [boxes, setBoxes] = useState([]);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Clear user data from localStorage
    localStorage.removeItem('user');
    // Clear user state
    setUser(null);
    // Navigate to login page
    navigate('/');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem' }}>
        <ProfileButton onLogout={handleLogout} />
      </div>
      <button onClick={() => setBoxes([...boxes, { id: Date.now() }])}>Add Box</button>
      {boxes.map(box => (
        <Box key={box.id} id={box.id} onDelete={(boxId) => setBoxes(boxes.filter(box => box.id !== boxId))} />
      ))}
    </div>
  );
}

export default DashboardPage;
