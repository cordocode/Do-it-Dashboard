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
  const [deletedBoxIds, setDeletedBoxIds] = useState(new Set()); // Track deleted boxes
  const isFirstRender = useRef(true);
  const lastPollTime = useRef(0);
  const navigate = useNavigate();

  // 1) Fetch the user's name from the database
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

  // 2) Poll for tasks every 5 seconds and merge with unsaved tasks
  useEffect(() => {
    if (!user) return;
    
    const fetchBoxes = () => {
      fetch(`${API_BASE_URL}/api/boxes?userId=${user.sub || user.email}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            lastPollTime.current = Date.now();
            
            setBoxes(prevBoxes => {
              // If this is the first render, just use the server data but filter out deleted boxes
              if (isFirstRender.current) {
                isFirstRender.current = false;
                return data.boxes.filter(box => !deletedBoxIds.has(box.id));
              }
              
              // Find all locally created or edited boxes
              const unsavedBoxes = prevBoxes.filter(box => 
                // Keep temporary boxes (not yet saved to server)
                (typeof box.id === "string" && box.id.startsWith("temp-")) ||
                // Keep boxes currently being edited
                editingBoxIds.has(box.id)
              );
              
              // Create maps for lookup
              const serverBoxMap = new Map(data.boxes.map(box => [box.id, box]));
              const unsavedBoxMap = new Map(unsavedBoxes.map(box => [box.id, box]));
              
              // Merge server data with unsaved/editing tasks
              const mergedBoxes = [];
              
              // First add server boxes (except deleted ones)
              for (const serverBox of data.boxes) {
                // Skip deleted boxes
                if (deletedBoxIds.has(serverBox.id)) continue;
                
                // If box is being edited, preserve local version
                if (editingBoxIds.has(serverBox.id)) {
                  mergedBoxes.push(unsavedBoxMap.get(serverBox.id));
                } else {
                  mergedBoxes.push(serverBox);
                }
              }
              
              // Add unsaved temporary boxes
              for (const unsavedBox of unsavedBoxes) {
                if (!serverBoxMap.has(unsavedBox.id) && !deletedBoxIds.has(unsavedBox.id)) {
                  mergedBoxes.push(unsavedBox);
                }
              }
              
              return mergedBoxes;
            });
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching boxes:', err);
          setLoading(false);
        });
    };

    // Initial fetch and set polling interval
    fetchBoxes();
    const intervalId = setInterval(fetchBoxes, 5000);
    return () => clearInterval(intervalId);
  }, [user, editingBoxIds, deletedBoxIds]); // Add deletedBoxIds as dependency

  // 3) Create a new box with a stable temporary ID
  const addBox = () => {
    const tempId = `temp-${Date.now()}`;
    setBoxes(prevBoxes => [...prevBoxes, { id: tempId, content: "" }]);
    
    // Mark as being edited
    setEditingBoxIds(prev => {
      const newSet = new Set(prev);
      newSet.add(tempId);
      return newSet;
    });
  };

  // 4) Delete a box - improved to handle immediate UI feedback
  const deleteBox = (boxId) => {
    // Track this as deleted to prevent reappearing during polling
    setDeletedBoxIds(prev => new Set([...prev, boxId]));
    
    // Remove from editing state
    setEditingBoxIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(boxId);
      return newSet;
    });
    
    // Remove from UI immediately
    setBoxes(prevBoxes => prevBoxes.filter(b => b.id !== boxId));
    
    // Only call API for non-temporary boxes
    if (boxId && !(typeof boxId === "string" && boxId.startsWith("temp-"))) {
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
    // If temporary ID became a real ID, update tracking
    if (typeof oldId === "string" && oldId.startsWith("temp-") && newBox.id !== oldId) {
      setDeletedBoxIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(oldId);
        return newSet;
      });
    }
    
    // Update box in state
    setBoxes(prevBoxes => prevBoxes.map(box =>
      box.id === oldId ? newBox : box
    ));
    
    // Update editing state
    if (oldId && editingBoxIds.has(oldId)) {
      setEditingBoxIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(oldId);
        // If box was being edited, continue tracking with new ID
        if (newBox && newBox.id) {
          newSet.add(newBox.id);
        }
        return newSet;
      });
    }
  };

  // 6) Track when a box is being edited
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

  // 7) Standard logout
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  // 8) Navigate to profile page
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