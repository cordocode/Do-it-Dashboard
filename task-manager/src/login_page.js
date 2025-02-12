import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';

const ClientID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function LoginPage({ setUser }) {
  const [error, setError] = useState('');
  const navigate = useNavigate(); // Enables navigation

  const handleSuccess = (credentialResponse) => {
    console.log('Login Success:', credentialResponse);

    try {
      const decoded = jwtDecode(credentialResponse.credential);
      console.log('Decoded User Info:', decoded);
      setUser(decoded); // Store user data
      navigate('/dashboard'); // Redirect to dashboard
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
    <div>
      <h1>Task Manager</h1>
      {error && <div style={{ color: 'red' }}>{error}</div>}

      <GoogleOAuthProvider clientId={ClientID}>
        <GoogleLogin onSuccess={handleSuccess} onError={handleError} />
      </GoogleOAuthProvider>
    </div>
  );
}

export default LoginPage;
