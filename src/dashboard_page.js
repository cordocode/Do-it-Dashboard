import React, { useState, useEffect } from "react";
import { Box, ProfileButton } from "./components";
import { useNavigate } from "react-router-dom";

function DashboardPage({ user, setUser }) {
  const [boxes, setBoxes] = useState([]);
  const navigate = useNavigate();

  // Fetch existing boxes from the backend for this user
  useEffect(() => {
    if (user) {
      fetch(`http://do-it-dashbaord-backend-env.eba-4qbyqf4f.us-east-2.elasticbeanstalk.com/api/boxes?userId=${user.sub || user.email}`)
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
    fetch('http://do-it-dashbaord-backend-env.eba-4qbyqf4f.us-east-2.elasticbeanstalk.com/api/boxes', {
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
    fetch(`http://localhost:4000/api/boxes/${boxId}`, {
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
          initialContent={box.content} // Pass the existing DB content
        />
      ))}
    </div>
  );
}

export default DashboardPage;
