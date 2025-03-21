// components.js

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useNavigate } from 'react-router-dom';
import { DateTime } from 'luxon';
import './css/the_box.css';
import './css/time.css';

// If your code references this base URL, keep it. If not, remove it.
const API_BASE_URL = process.env.NODE_ENV === 'development'
  ? 'http://localhost:8080'
  : 'https://backend.formybuddy.com';

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
   🟢 TIME SELECTOR MODAL COMPONENT
======================================== */
function TimeModal({ timeType, setTimeType, timeValue, setTimeValue, onClose, onDone, boxId }) {
  // Local state for the text input
  const [timeText, setTimeText] = useState(timeValue || "");

  // Handle text input change
  const handleTimeTextChange = (e) => {
    setTimeText(e.target.value);
  };

  // Apply time settings and close modal
  const handleDone = () => {
    setTimeValue(timeText);
    onDone();
  };

  return createPortal(
    <>
      <div className="time-modal-backdrop" onClick={onClose}></div>
      <div className="time-selector">
        <div className="time-selector-header">
          <h4>Time Settings</h4>
          <button className="time-close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="time-selector-body">
          {/* Horizontal radio buttons */}
          <div className="time-type-selector-horizontal">
            <label className={timeType === "none" ? "selected" : ""}>
              <input
                type="radio"
                name={`timeType-${boxId || 'new'}`}
                value="none"
                checked={timeType === "none"}
                onChange={() => setTimeType("none")}
              />
              <span>No Time</span>
            </label>
            
            <label className={timeType === "scheduled" ? "selected" : ""}>
              <input
                type="radio"
                name={`timeType-${boxId || 'new'}`}
                value="scheduled"
                checked={timeType === "scheduled"}
                onChange={() => setTimeType("scheduled")}
              />
              <span>Scheduled</span>
            </label>
            
            <label className={timeType === "deadline" ? "selected" : ""}>
              <input
                type="radio"
                name={`timeType-${boxId || 'new'}`}
                value="deadline"
                checked={timeType === "deadline"}
                onChange={() => setTimeType("deadline")}
              />
              <span>Deadline</span>
            </label>
          </div>
          
          {/* Natural language time input */}
          <div className="time-input-container">
            <input
              type="text"
              className="time-text-input"
              value={timeText}
              onChange={handleTimeTextChange}
              disabled={timeType === "none"}
              placeholder="e.g. 'tomorrow at 3pm'"
            />
          </div>
        </div>

        <div className="time-modal-actions">
          <button className="time-cancel-button" onClick={onClose}>Cancel</button>
          <button className="time-save-button" onClick={handleDone}>Done</button>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ========================================
   🟢 STATUS INDICATOR COMPONENT
======================================== */
function StatusIndicator({ status }) {
  const statusClass = {
    unsaved: 'status-unsaved',
    modified: 'status-modified',
    saved: 'status-saved',
  }[status];

  return <div className={`status-indicator ${statusClass}`} />;
}

/* ========================================
   🟢 BOX COMPONENT
======================================== */
export function Box({
  id,
  user,
  onDelete,
  onSave,
  initialContent = "",
  initialTimeType = "none",
  initialTimeValue = "",
  userTimeZone, 
}) {
  const [text, setText] = useState(initialContent);
  const [savedText, setSavedText] = useState(initialContent);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [timeType, setTimeType] = useState(initialTimeType);
  const [timeValue, setTimeValue] = useState(initialTimeValue);
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const textareaRef = useRef(null);

  const getStatus = () => {
    if (savedText === "") return "unsaved";
    if (text === savedText) return "saved";
    return "modified";
  };

  useEffect(() => {
    // Auto-resize on mount
    if (textareaRef.current) {
      adjustTextareaHeight();
    }

    // ESC to close time selector
    function handleEscapeKey(e) {
      if (e.key === "Escape" && showTimeSelector) {
        setShowTimeSelector(false);
      }
    }
    document.addEventListener("keydown", handleEscapeKey);
    return () => document.removeEventListener("keydown", handleEscapeKey);
  }, [showTimeSelector]);

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
    const method = id ? "PUT" : "POST";
    const userId = user?.sub || user?.email;

    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        content: text,
        time_type: timeType,
        time_value: timeValue === "" ? null : timeValue,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setSavedText(text);
          onSave(id, data.box);
        } else {
          console.error("Failed to save box.");
        }
      })
      .catch((err) => console.error("Error saving box:", err));
  };

  const handleDelete = () => {
    onDelete(id);
    setShowConfirmation(false);
  };

  const toggleTimeSelector = () => {
    setShowTimeSelector(!showTimeSelector);
  };

  const handleTimeSettingsDone = () => {
    setShowTimeSelector(false);
    // Auto-save after setting time
    if (getStatus() !== "saved" || timeType !== "none") {
      handleSave();
    }
  };

  // Render the "Scheduled" or "Due" badge
  const renderTimeTypeBadge = () => {
    if (timeType === "none") return null;
    return (
      <div className={`time-type-badge ${timeType}`}>
        {timeType === "deadline" ? "Due" : "Scheduled"}
      </div>
    );
  };

  // Render the local-time display
  const renderTimeDisplay = () => {
    if (!timeValue || timeType === "none") return null;

    // 🟢 Add debug logs to see exactly what is happening:
    console.log("DEBUG: userTimeZone =", userTimeZone);
    const parsedUtc = DateTime.fromISO(timeValue, { zone: "utc" });
    console.log("DEBUG: parsedUtc =", parsedUtc.toString());
    
    const local = parsedUtc.setZone(userTimeZone || "UTC");
    console.log("DEBUG: local =", local.toString());

    const localTimeDisplay = local.toLocaleString(DateTime.DATETIME_MED);
    console.log("DEBUG: localTimeDisplay =", localTimeDisplay);

    return (
      <div className="time-display">
        {timeType === "deadline" ? "Due: " : "Scheduled: "}
        {localTimeDisplay}
      </div>
    );
  };

  return (
    <div className="box-container">
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

      {/* If there's a time value and it's not 'none', show it */}
      {timeType !== "none" && timeValue && (
        <div className="box-time-display">
          {renderTimeTypeBadge()}
          {renderTimeDisplay()}
        </div>
      )}

      <div className="box-controls-row">
        <div className="button-group">
          <button
            className={`save-button ${getStatus() === "saved" ? "saved" : ""}`}
            onClick={handleSave}
          >
            {getStatus() === "saved" ? "Saved" : "Save"}
          </button>

          {/* Time toggle button */}
          <button
            className="time-toggle-button"
            onClick={toggleTimeSelector}
            aria-label="Set time options"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>
              {timeType === "none"
                ? "Set time"
                : timeValue
                ? "Edit time"
                : "Set time"}
            </span>
          </button>
        </div>

        {/* Delete button */}
        <button className="delete-button" onClick={() => setShowConfirmation(true)}>
          Delete
        </button>

        {showConfirmation && (
          <ConfirmationPopup
            onConfirm={handleDelete}
            onCancel={() => setShowConfirmation(false)}
          />
        )}

        {showTimeSelector && (
          <TimeModal
            timeType={timeType}
            setTimeType={setTimeType}
            timeValue={timeValue}
            setTimeValue={setTimeValue}
            onClose={() => setShowTimeSelector(false)}
            onDone={handleTimeSettingsDone}
            boxId={id}
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
