// components.js

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import "./css/the_box.css";
import "./css/time.css";

// If your code references this base URL, keep it. If not, remove it.
const API_BASE_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:8080"
    : "https://backend.formybuddy.com";

/* ========================================
   🟢 GOOGLE LOGIN BUTTON COMPONENT
======================================== */
const ClientID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

export function GoogleLoginButton({ onSuccess, onError }) {
  if (!ClientID) {
    return (
      <div className="google-login-error">
        Error: Google Client ID not found.
      </div>
    );
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
      <button className="confirmation-button" onClick={onConfirm}>
        Confirm
      </button>
      <button className="confirmation-button" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

/* ========================================
   🟢 TIME SELECTOR MODAL COMPONENT
======================================== */

function TimeModal({
  timeType,
  setTimeType,
  timeValue,
  setTimeValue,
  onClose,
  onDone,
  boxId,
  userTimeZone,
}) {
  // Track if we're working with natural language text or UTC timestamp
  const [timeText, setTimeText] = useState("");
  const [parsedResult, setParsedResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Parse natural language input
  useEffect(() => {
    if (timeType === "none" || !timeText) {
      setParsedResult(null);
      return;
    }

    // Skip parsing if already an ISO string
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeText)) {
      return;
    }

    // Wait for typing to stop
    const timer = setTimeout(() => {
      setIsProcessing(true);
      
      fetch(`${API_BASE_URL}/api/parse-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeString: timeText,
          timeZone: userTimeZone,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setParsedResult(data);
          } else {
            setParsedResult(null);
          }
          setIsProcessing(false);
        })
        .catch((err) => {
          console.error("Error parsing time:", err);
          setIsProcessing(false);
        });
    }, 500);

    return () => clearTimeout(timer);
  }, [timeText, timeType, userTimeZone]);

  const handleTimeTextChange = (e) => {
    setTimeText(e.target.value);
  };

  const handleDone = () => {
    // CRITICAL LOGIC: Don't re-convert existing UTC timestamps
    if (!timeText && timeValue && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeValue)) {
      // User didn't change anything - keep original timestamp
      onDone(timeValue);
    } else if (parsedResult && parsedResult.parsed) {
      // User entered natural language that was successfully parsed
      onDone(parsedResult.parsed);
    } else {
      // User entered text but parsing failed
      onDone(timeText);
    }
    
    onClose();
  };

  // Calculate placeholder text
  const getPlaceholder = () => {
    if (timeValue && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeValue)) {
      // Show local time for existing timestamp
      return new Date(timeValue).toLocaleString("en-US", {
        weekday: "short",
        month: "short", 
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: userTimeZone
      });
    }
    return "e.g. 'tomorrow at 3pm'";
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
          {/* Radio buttons */}
          <div className="time-type-selector-horizontal">
            <label className={timeType === "none" ? "selected" : ""}>
              <input
                type="radio"
                name={`timeType-${boxId || "new"}`}
                value="none"
                checked={timeType === "none"}
                onChange={() => setTimeType("none")}
              />
              <span>No Time</span>
            </label>

            <label className={timeType === "scheduled" ? "selected" : ""}>
              <input
                type="radio"
                name={`timeType-${boxId || "new"}`}
                value="scheduled"
                checked={timeType === "scheduled"}
                onChange={() => setTimeType("scheduled")}
              />
              <span>Scheduled</span>
            </label>

            <label className={timeType === "deadline" ? "selected" : ""}>
              <input
                type="radio"
                name={`timeType-${boxId || "new"}`}
                value="deadline"
                checked={timeType === "deadline"}
                onChange={() => setTimeType("deadline")}
              />
              <span>Deadline</span>
            </label>
          </div>

          {/* Time input */}
          <div className="time-input-container">
            <input
              type="text"
              className="time-text-input"
              value={timeText}
              onChange={handleTimeTextChange}
              disabled={timeType === "none"}
              placeholder={getPlaceholder()}
            />
            
            {isProcessing && (
              <div className="time-processing">Processing...</div>
            )}
          </div>
        </div>

        <div className="time-modal-actions">
          <button className="time-cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="time-save-button" 
            onClick={handleDone}
            disabled={isProcessing && timeType !== "none"}
          >
            Done
          </button>
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
    unsaved: "status-unsaved",
    modified: "status-modified",
    saved: "status-saved",
  }[status];

  return <div className={`status-indicator ${statusClass}`} />;
}

/* ========================================
   🟢 DELETE CONFIRMATION COMPONENT
======================================== */
function DeleteConfirmation({ isOpen, position, onConfirm, onCancel }) {
  if (!isOpen) return null;
  
  return createPortal(
    <div className="delete-confirmation-wrapper">
      <div 
        className="delete-confirmation-backdrop" 
        onClick={onCancel}
      ></div>
      <div 
        className="delete-confirmation-portal" 
        style={position}
      >
        <p>Are you sure?</p>
        <div className="delete-confirmation-buttons">
          <button 
            className="confirm-delete-button" 
            onClick={onConfirm}
          >
            Confirm
          </button>
          <button 
            className="cancel-delete-button" 
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
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
  const deleteButtonRef = useRef(null);
  const [deletePosition, setDeletePosition] = useState({ top: 0, right: 0 });

  // Update state when props change
  useEffect(() => {
    setTimeType(initialTimeType);
    setTimeValue(initialTimeValue);
  }, [initialTimeType, initialTimeValue]);

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
    return () =>
      document.removeEventListener("keydown", handleEscapeKey);
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

  // Updated handleSave accepts an optional finalTimeValue parameter
  const handleSave = (finalTimeValue) => {
    // Use the passed finalTimeValue if provided, else fall back to the state value
    const effectiveTimeValue =
      finalTimeValue !== undefined ? finalTimeValue : timeValue;
    const url = id
      ? `${API_BASE_URL}/api/boxes/${id}`
      : `${API_BASE_URL}/api/boxes`;
    const method = id ? "PUT" : "POST";
    const userId = user?.sub || user?.email;

    console.log("Box - Saving:", {
      boxId: id,
      method: id ? "PUT" : "POST",
      timeType,
      hasTimeValue: !!effectiveTimeValue
    });

    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        content: text,
        time_type: timeType,
        time_value:
          effectiveTimeValue === "" ? null : effectiveTimeValue,
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

    // Check if timeValue is a natural language string or an ISO date
    const isISOString = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(timeValue);

    if (!isISOString) {
      return (
        <div className="time-display">
          <span className="pending-time">{timeValue}</span>
        </div>
      );
    }

    try {
      // This is the key part - always use the userTimeZone when formatting
      const formattedTime = new Date(timeValue).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: userTimeZone || 'UTC'  // Ensure we always use the user's timezone
      });
      
      return <div className="time-display">{formattedTime}</div>;
    } catch (error) {
      console.error("Error in time processing:", error);
      return <div className="time-display">{timeValue}</div>;
    }
  };

  // Calculate position for delete confirmation
  const updateDeletePosition = () => {
    if (deleteButtonRef.current) {
      const rect = deleteButtonRef.current.getBoundingClientRect();
      setDeletePosition({
        top: `${rect.bottom + 8}px`,
        right: `${window.innerWidth - rect.right}px`, // Align to right edge of button
        width: `180px` // Fixed width for consistency
      });
    }
  };

  // When confirmation is toggled, update position
  const toggleConfirmation = () => {
    if (!showConfirmation) {
      updateDeletePosition();
    }
    setShowConfirmation(!showConfirmation);
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
            onClick={() => handleSave()}
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

        {/* Updated delete button */}
        <div className="delete-action-container">
          <button
            ref={deleteButtonRef}
            className="delete-button"
            onClick={toggleConfirmation}
            aria-expanded={showConfirmation}
            aria-haspopup="true"
          >
            Delete
          </button>
          
          <DeleteConfirmation 
            isOpen={showConfirmation}
            position={deletePosition}
            onConfirm={handleDelete}
            onCancel={() => setShowConfirmation(false)}
          />
        </div>

        {showTimeSelector && (
          <TimeModal
            timeType={timeType}
            setTimeType={setTimeType}
            timeValue={timeValue}
            setTimeValue={setTimeValue}
            onClose={() => setShowTimeSelector(false)}
            onDone={(finalValue) => {
              setTimeValue(finalValue);
              setShowTimeSelector(false);
              handleSave(finalValue);
            }}
            boxId={id}
            userTimeZone={userTimeZone}
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