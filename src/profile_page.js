import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileButton } from './components'; 
import './css/global.css';
import './css/landing_page.css';
import './css/profile_page.css';
import './css/the_box.css';
import './css/time.css';

// 1) Point this to your backend URL in production.
//    Locally, you might use "http://localhost:8080".
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080'
  : 'https://backend.formybuddy.com'; 

/* ========================================
   Verified Phone Section
======================================== */
function PhoneVerifiedSection({ phoneNumber, onChangeRequested }) {
  return (
    <div className="verified-phone-container">
      <div className="verified-status">
        <svg 
          className="verified-icon" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <span>Verified</span>
      </div>
      <div className="verified-phone-number">
        {phoneNumber}
      </div>
      <p className="phone-info">
        You can now receive notifications and manage tasks via SMS.
      </p>
      <button 
        className="secondary-button"
        onClick={onChangeRequested}
      >
        Change Phone Number
      </button>
    </div>
  );
}

/* ========================================
   Phone Verification Form
======================================== */
function PhoneVerificationForm({ userId, initialPhoneNumber, onVerificationSuccess }) {
  const [phoneInput, setPhoneInput] = useState(initialPhoneNumber || '');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Send verification code
  const sendVerificationCode = () => {
    if (!phoneInput) {
      setError('Please enter a phone number');
      return;
    }
    
    // Quick phone validation
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(phoneInput.replace(/\s+/g, ''))) {
      setError('Please enter a valid phone number with country code (e.g., +1XXXXXXXXXX)');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    // 2) Call the backend endpoint
    fetch(`${API_BASE_URL}/api/send-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        phoneNumber: phoneInput.replace(/\s+/g, '')
      }),
    })
      .then(response => response.json())
      .then(data => {
        setIsSubmitting(false);
        if (data.success) {
          setVerificationSent(true);
        } else {
          setError(data.error || 'Failed to send verification code. Please try again.');
        }
      })
      .catch(err => {
        console.error('Error sending verification code:', err);
        setIsSubmitting(false);
        setError('An error occurred. Please try again.');
      });
  };

  // Verify the code
  const verifyCode = () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    // 3) Call the backend to verify
    fetch(`${API_BASE_URL}/api/verify-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        code: verificationCode,
        phoneNumber: phoneInput.replace(/\s+/g, '')
      }),
    })
      .then(response => response.json())
      .then(data => {
        setIsSubmitting(false);
        if (data.success) {
          onVerificationSuccess(phoneInput); // Let parent component know phone is verified
        } else {
          setError(data.error || 'Verification failed. Please try again.');
        }
      })
      .catch(err => {
        console.error('Error verifying code:', err);
        setIsSubmitting(false);
        setError('An error occurred. Please try again.');
      });
  };

  return (
    <div className="phone-verification-form">
      {!verificationSent ? (
        <>
          <p className="verification-instructions">
            Add your phone number to enable SMS notifications and task management.
          </p>
          <div className="phone-input-container">
            <input
              type="tel"
              className="phone-input"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="+1 (XXX) XXX-XXXX"
              disabled={isSubmitting}
            />
            <button 
              className="primary-button"
              onClick={sendVerificationCode}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Code'}
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
        </>
      ) : (
        <>
          <p className="verification-instructions">
            Enter the 6-digit verification code sent to <strong>{phoneInput}</strong>
          </p>
          <div className="verification-code-container">
            <input
              type="text"
              className="verification-code-input"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength="6"
              disabled={isSubmitting}
            />
            <button 
              className="primary-button"
              onClick={verifyCode}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Verifying...' : 'Verify'}
            </button>
          </div>
          {error && <div className="error-message">{error}</div>}
          <button 
            className="text-button" 
            onClick={() => setVerificationSent(false)} 
            disabled={isSubmitting}
          >
            Change Phone Number
          </button>
          <button 
            className="text-button" 
            onClick={sendVerificationCode} 
            disabled={isSubmitting}
          >
            Resend Code
          </button>
        </>
      )}
    </div>
  );
}

/* ========================================
   Main ProfilePage Component
======================================== */
function ProfilePage({ user, setUser }) {
  const [firstName, setFirstName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      // Initialize the firstName from Google token or fallback
      setFirstName(user.given_name || user.name?.split(' ')[0] || '');
      
      // 4) Fetch the user's profile from your backend
      fetch(`${API_BASE_URL}/api/user-profile?userId=${user.sub}`)
        .then((res) => res.json())
        .then(data => {
          if (data.success) {
            setPhoneNumber(data.profile.phone_number || '');
            setIsPhoneVerified(data.profile.phone_verified || false);

            // If the DB has a stored first_name, use that instead
            if (data.profile.first_name) {
              setFirstName(data.profile.first_name);
            }
          }
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching profile:', err);
          setLoading(false);
        });
    }
  }, [user]);

  // Logs the user out
  const handleLogout = () => {
    localStorage.removeItem('user');
    setUser(null);
    navigate('/');
  };

  // Navigates to the profile page
  const handleProfileClick = () => navigate('/profile');

  // Saves the user's name
  const saveName = () => {
    setIsSaving(true);
    setSaveSuccess(false);

    fetch(`${API_BASE_URL}/api/user-profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.sub || user.email,
        firstName
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSaveSuccess(true);
          // Reset success message after 3 seconds
          setTimeout(() => {
            setSaveSuccess(false);
          }, 3000);
        } else {
          console.error('Failed to update name:', data.error);
        }
        setIsSaving(false);
      })
      .catch(err => {
        console.error('Error updating name:', err);
        setIsSaving(false);
      });
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
        <h1>Your Profile</h1>
        {loading ? (
          <div className="loading-spinner"></div>
        ) : (
          <div className="profile-content">
            {/* Account Information */}
            <div className="profile-section">
              <h2>Account Information</h2>
              
              {/* Name field */}
              <div className="profile-field">
                <label>Name:</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter your name"
                  disabled={isSaving}
                />
              </div>
              
              <button 
                className={`save-name-button ${isSaving ? 'saving' : ''} ${saveSuccess ? 'saved' : ''}`}
                onClick={saveName}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : saveSuccess ? 'Saved!' : 'Save Name'}
              </button>
              
              {saveSuccess && (
                <div className="save-confirmation">
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
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  Name saved successfully!
                </div>
              )}
            </div>

            {/* Phone Verification Section */}
            <div className="profile-section">
              <h2>Phone Verification</h2>
              {isPhoneVerified ? (
                <PhoneVerifiedSection 
                  phoneNumber={phoneNumber} 
                  onChangeRequested={() => setIsPhoneVerified(false)} 
                />
              ) : (
                <PhoneVerificationForm 
                  userId={user?.sub || user?.email} 
                  initialPhoneNumber={phoneNumber} 
                  onVerificationSuccess={(phone) => {
                    setPhoneNumber(phone);
                    setIsPhoneVerified(true);
                  }} 
                />
              )}
            </div>

            <button className="back-button" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default ProfilePage;
