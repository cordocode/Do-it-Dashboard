import React, { useState } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";
import './components.css';


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
         <button className="confirmation-button" onClick={onConfirm}>✓</button>
         <button className="confirmation-button" onClick={onCancel}>✗</button>
       </div>
     );
   }
   
   /* ========================================
      🟢 BOX COMPONENT
      ======================================== */
   export function Box({ id, onDelete }) {
     const [text, setText] = useState("");
     const [showConfirmation, setShowConfirmation] = useState(false);
   
     return (
       <div className="box-container">
         <textarea
           className="box-textarea"
           value={text}
           onChange={(e) => {
             setText(e.target.value);
             e.target.style.height = "auto";
             e.target.style.height = e.target.scrollHeight + "px";
           }}
         />
         <button className="delete-button" onClick={() => setShowConfirmation(true)}>
           -
         </button>
         {showConfirmation && (
           <ConfirmationPopup
             onConfirm={() => onDelete(id)}
             onCancel={() => setShowConfirmation(false)}
           />
         )}
       </div>
     );
   }

/* ========================================
   🟢 PROFILE BUTTON COMPONENT
   ======================================== */
export function ProfileButton({ onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    onLogout();
    setIsOpen(false);
  };

  return (
    <div className="profile-container">
      <button 
        className="profile-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Profile"
      >
        <span className="profile-icon">👤</span>
      </button>
      {isOpen && (
        <div className="profile-dropdown">
          <button className="logout-button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}