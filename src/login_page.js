import React, { useState, useEffect } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import '../src/components.css';

const ClientID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function LoginPage({ setUser }) {
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // Check for existing Google session
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: ClientID,
        callback: handleSuccess,
      });

      // Trigger automatic prompt
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
  }, []);

  const handleSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      setUser(decoded); // This will now also save to localStorage
      navigate('/dashboard');
    } catch (error) {
      console.error('Error decoding credential:', error);
      setError('Failed to process login information.');
    }
  };

  const handleError = () => {
    setError('Login failed. Please try again.');
  };

  if (!ClientID) {
    return <div>Error: Google Client ID not found. Make sure to set REACT_APP_GOOGLE_CLIENT_ID in your .env file.</div>;
  }

  return (
    <div className="centered-container">
      <h1>Hey there</h1>
      {error && <div className="google-login-error">{error}</div>}
      <GoogleOAuthProvider clientId={ClientID}>
        <GoogleLogin onSuccess={handleSuccess} onError={handleError} />
      </GoogleOAuthProvider>
    </div>
  );
}

export default LoginPage;
