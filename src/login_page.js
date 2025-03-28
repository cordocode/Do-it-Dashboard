import React, { useState, useCallback, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import './css/global.css';
import './css/landing_page.css';
import './css/profile_page.css';
import './css/the_box.css';
import './css/time.css';

const ClientID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function LoginPage({ setUser }) {
  const [error, setError] = useState('');
  const containerRef = useRef(null);

  // Memoize handleSuccess to avoid dependency issues
  const handleSuccess = useCallback((credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      setUser(decoded);
      // No explicit navigation - will be handled by Route components
    } catch (error) {
      console.error('Error decoding credential:', error);
      setError('Failed to process login information.');
    }
  }, [setUser]);

  // Simple animation for container entrance
  React.useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        containerRef.current.classList.add('visible');
      }, 300);
    }
    
    // Initialize Google Auth
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: ClientID,
        callback: handleSuccess,
      });

      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed()) {
          console.log('Auto login not possible');
        } else if (notification.isSkippedMoment()) {
          console.log('User skipped auto login');
        } else if (notification.isDismissedMoment()) {
          console.log('User dismissed auto login');
        }
      });
    }
  }, [handleSuccess]);

  const handleError = () => {
    setError('Login failed. Please try again.');
  };

  if (!ClientID) {
    return <div>Error: Google Client ID not found. Make sure to set REACT_APP_GOOGLE_CLIENT_ID in your .env file.</div>;
  }

  return (
    <div className="ethereal-login-container" ref={containerRef}>
      <div className="login-content">
        <div className="welcome-message">
          <h1>Welcome to Buddy</h1>
          <p>Your personal task assistant</p>
        </div>
        
        {error && <div className="google-login-error">{error}</div>}
        
        <div className="login-button-container" style={{ 
          transform: 'scale(0.85)', 
          marginTop: '20px',
          opacity: '0.85'
        }}>
          <GoogleOAuthProvider clientId={ClientID}>
            <GoogleLogin 
              onSuccess={handleSuccess} 
              onError={handleError}
              theme="filled_black"
              shape="pill"
              text="continue_with"
              locale="en"
            />
          </GoogleOAuthProvider>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;