import React, { useState, useEffect, useRef } from "react";
import { Box, ProfileButton } from "./components";
import { useNavigate } from "react-router-dom";
import './components.css';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com';

function DashboardPage({ user, setUser }) {
  const [displayName, setDisplayName] = useState('');
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingBoxIds, setEditingBoxIds] = useState(new Set());
  const [deletedBoxIds, setDeletedBoxIds] = useState(new Set());
  const isFirstRender = useRef(true);
  const currentBoxesRef = useRef(new Map());
  const navigate = useNavigate();

  // Keep a reference to the current boxes for comparison
  useEffect(() => {
    currentBoxesRef.current = new Map(
      boxes.map(box => [box.id, box])
    );
  }, [boxes]);

  // Fetch user's name
  useEffect(() => {
    if (user) {
      fetch(`${API_BASE_URL}/api/user-profile?userId=${user.sub}&email=${user.email}`)
        .then(response => response.json())
        .then(data => {
          if (data.success && data.profile.first_name) {
            setDisplayName(data.profile.first_name);
          } else {
            setDisplayName('friend');
          }
        })
        .catch(err => console.error('Error fetching user name:', err));
    }
  }, [user]);

  // Poll for tasks
  useEffect(() => {
    if (!user) return;
    
    const fetchBoxes = () => {
      fetch(`${API_BASE_URL}/api/boxes?userId=${user.sub || user.email}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            setBoxes(prevBoxes => {
              if (isFirstRender.current) {
                isFirstRender.current = false;
                return data.boxes.filter(box => !deletedBoxIds.has(box.id));
              }
              
              // Create new boxes array
              const newBoxes = [];
              const prevBoxMap = new Map(prevBoxes.map(box => [box.id, box]));
              
              // Process server boxes first
              for (const serverBox of data.boxes) {
                // Skip deleted boxes
                if (deletedBoxIds.has(serverBox.id)) continue;
                
                const prevBox = prevBoxMap.get(serverBox.id);
                const isBeingEdited = editingBoxIds.has(serverBox.id);
                
                // If this box is being edited locally, keep local version
                if (isBeingEdited && prevBox) {
                  newBoxes.push(prevBox);
                }
                // Otherwise use server version (handles updates from other sources)
                else {
                  newBoxes.push(serverBox);
                }
              }
              
              // Add local temporary boxes that don't exist on server yet
              for (const box of prevBoxes) {
                // Add temporary boxes not yet saved
                if (typeof box.id === "string" && box.id.startsWith("temp-")) {
                  newBoxes.push(box);
                }
              }
              
              return newBoxes;
            });
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching boxes:', err);
          setLoading(false);
        });
    };

    fetchBoxes();
    const intervalId = setInterval(fetchBoxes, 5000);
    return () => clearInterval(intervalId);
  }, [user, editingBoxIds, deletedBoxIds]);

  // Create new box
  const addBox = () => {
    const tempId = `temp-${Date.now()}`;
    setBoxes(prevBoxes => [...prevBoxes, { id: tempId, content: "" }]);
    
    setEditingBoxIds(prev => {
      const newSet = new Set(prev);
      newSet.add(tempId);
      return newSet;
    });
  };

  // Delete box
  const deleteBox = (boxId) => {
    // Mark as deleted to prevent reappearing
    setDeletedBoxIds(prev => new Set([...prev, boxId]));
    
    // Remove from editing state
    setEditingBoxIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(boxId);
      return newSet;
    });
    
    // Remove from UI immediately
    setBoxes(prevBoxes => prevBoxes.filter(b => b.id !== boxId));
    
    // Call API for non-temp boxes
    if (boxId && !(typeof boxId === "string" && boxId.startsWith("temp-"))) {
      fetch(`${API_BASE_URL}/api/boxes/${boxId}`, {
        method: 'DELETE',
      })
        .then(response => response.json())
        .catch(err => console.error(err));
    }
  };

  // Handle box save
  const handleBoxSave = (oldId, newBox) => {
    if (typeof oldId === "string" && oldId.startsWith("temp-") && newBox.id !== oldId) {
      setDeletedBoxIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(oldId);
        return newSet;
      });
    }
    
    setBoxes(prevBoxes => prevBoxes.map(box => 
      box.id === oldId ? newBox : box
    ));
    
    // Update editing state
    setEditingBoxIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(oldId);
      return newSet;
    });
  };

  // Track editing state
  const handleBoxEdit = (boxId, isEditing) => {
    setEditingBoxIds(prev => {
      const newSet = new Set(prev);
      if (isEditing) {
        newSet.add(boxId);
      } else {
        newSet.delete(boxId);
      }
      return newSet;
    });
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  // Profile navigation
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
                key={box.id}
                id={box.id}
                user={user}
                onDelete={deleteBox}
                onSave={handleBoxSave}
                onEditStateChange={(isEditing) => handleBoxEdit(box.id, isEditing)}
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