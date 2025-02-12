import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

const ClientID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function App() {
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);

  const handleSuccess = (credentialResponse) => {
    console.log('Login Success:', credentialResponse);
    
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      console.log('Decoded User Info:', decoded);
      setUser(decoded);
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
      
      {user ? (
        <div>
          <h2>Welcome, {user.name}!</h2>
          <p>Email: {user.email}</p>
          {user.picture && <img 
            src={user.picture} 
            alt="Profile" 
            style={{ width: 100, height: 100, borderRadius: '50%' }}
          />}
        </div>
      ) : (
        <div>
          <GoogleOAuthProvider clientId={ClientID}>
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
            />
          </GoogleOAuthProvider>
        </div>
      )}
    </div>
  );
}

export default App;