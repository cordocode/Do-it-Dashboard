import React, { useState, useEffect, useRef } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from 'react-router-dom';
import './components.css';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com'

/* ========================================
   🟢 GOOGLE LOGIN BUTTON COMPONENT
   ======================================== */
const ClientID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export function GoogleLoginButton({ onSuccess, onError }) {
  if (!ClientID) {
    return <div className="google-login-error">Error: Google Client ID not found.</div>;
  }

  return (
    <div className="google-login-container">
      <GoogleOAuthProvider clientId={ClientID}>
        <GoogleLogin onSuccess={onSuccess} onError={onError} />
      </GoogleOAuthProvider>
    </div>
  );
}

/* ========================================
   🟢 CONFIRMATION POPUP COMPONENT
   ======================================== */
export function ConfirmationPopup({ onConfirm, onCancel }) {
  return (
    <div className="confirmation-popup">
      <button className="confirmation-button" onClick={onConfirm}>Confirm</button>
      <button className="confirmation-button" onClick={onCancel}>Cancel</button>
    </div>
  );
}

/* ========================================
   🟢 STATUS INDICATOR COMPONENT
   ======================================== */
function StatusIndicator({ status }) {
  const statusClass = {
    unsaved: 'status-unsaved',
    modified: 'status-modified',
    saved: 'status-saved'
  }[status];

  return <div className={`status-indicator ${statusClass}`} />;
}

/* ========================================
   🟢 BOX COMPONENT
   ======================================== */
export function Box({ id, user, onDelete, onSave, initialContent = "" }) {
  const [text, setText] = useState(initialContent);
  const [savedText, setSavedText] = useState(initialContent);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  // Determine status based on current state
  const getStatus = () => {
    if (savedText === "") return "unsaved";
    if (text === savedText) return "saved";
    return "modified";
  };

  useEffect(() => {
    // Auto-resize textarea on initial load
    if (textareaRef.current) {
      adjustTextareaHeight();
    }
  }, []);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    adjustTextareaHeight();
  };

  const handleSave = () => {
    const url = id 
      ? `${API_BASE_URL}/api/boxes/${id}` 
      : `${API_BASE_URL}/api/boxes`;
    const method = id ? 'PUT' : 'POST';
    const userId = user?.sub || user?.email;

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        content: text
      }),
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setSavedText(text); // Update saved text reference
          onSave(id, data.box);
        } else {
          console.error('Failed to save box.');
        }
      })
      .catch(err => console.error('Error saving box:', err));
  };

  const handleDelete = () => {
    // Always call onDelete with the current box id (or null)
    onDelete(id);
    setShowConfirmation(false);
  };

  return (
    <div className="box-container" ref={containerRef}>
      <div className="textarea-container">
        <StatusIndicator status={getStatus()} />
        <textarea
          ref={textareaRef}
          className="box-textarea"
          value={text}
          onChange={handleTextChange}
          placeholder="Write your task here..."
        />
      </div>
      <div className="box-controls">
        <button 
          className={`save-button ${getStatus() === 'saved' ? 'saved' : ''}`} 
          onClick={handleSave}
        >
          {getStatus() === 'saved' ? 'Saved' : 'Save'}
        </button>
        <button 
          className="delete-button" 
          onClick={() => setShowConfirmation(true)}
        >
          Delete
        </button>
        {showConfirmation && (
          <ConfirmationPopup
            onConfirm={handleDelete}
            onCancel={() => setShowConfirmation(false)}
          />
        )}
      </div>
    </div>
  );
}

/* ========================================
   🟢 PROFILE BUTTON COMPONENT
   ======================================== */
export function ProfileButton({ onLogout, onProfileClick }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    onLogout();
    setIsOpen(false);
  };

  const goToProfile = () => {
    if (onProfileClick) {
      onProfileClick();
    }
    setIsOpen(false);
  };

  return (
    <div className="profile-container" ref={dropdownRef}>
      <button 
        className="profile-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile"
      >
        <svg 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </button>
      {isOpen && (
        <div className="profile-dropdown">
          <button className="profile-menu-item" onClick={goToProfile}>
            Profile
          </button>
          <button className="logout-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
