import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './css/global.css';
import './css/onboarding.css';

const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com';

/* ========================================
   Step Indicator Component
======================================== */
function StepIndicator({ currentStep, totalSteps }) {
  return (
    <div className="step-indicator">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div 
          key={i} 
          className={`step-dot ${i < currentStep ? 'completed' : i === currentStep ? 'active' : ''}`}
        />
      ))}
    </div>
  );
}

/* ========================================
   Name Step Component 
======================================== */
function NameStep({ firstName, setFirstName, onNext }) {
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!firstName.trim()) {
      setError('Please enter your name');
      return;
    }
    onNext();
  };

  return (
    <div className="onboarding-step name-step">
      <h2>What should we call you?</h2>
      <p>This will help personalize your experience.</p>
      
      <div className="form-field">
        <input
          type="text"
          value={firstName}
          onChange={(e) => {
            setFirstName(e.target.value);
            setError('');
          }}
          placeholder="Enter your name"
          className={error ? 'error' : ''}
        />
        {error && <div className="error-message">{error}</div>}
      </div>

      <button 
        className="primary-button"
        onClick={handleContinue}
      >
        Continue
      </button>
    </div>
  );
}

/* ========================================
   Phone Verification Step Component 
   (Adapted from ProfilePage)
======================================== */
function PhoneStep({ userId, phoneNumber, setPhoneNumber, setIsPhoneVerified, onNext }) {
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Send verification code
  const sendVerificationCode = () => {
    if (!phoneNumber) {
      setError('Please enter a phone number');
      return;
    }
    
    // Quick phone validation
    const phoneRegex = /^\+?[1-9]\d{9,14}$/;
    if (!phoneRegex.test(phoneNumber.replace(/\s+/g, ''))) {
      setError('Please enter a valid phone number with country code (e.g., +1XXXXXXXXXX)');
      return;
    }
    
    setIsSubmitting(true);
    setError('');

    fetch(`${API_BASE_URL}/api/send-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        phoneNumber: phoneNumber.replace(/\s+/g, '')
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

    fetch(`${API_BASE_URL}/api/verify-phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: userId,
        code: verificationCode,
        phoneNumber: phoneNumber.replace(/\s+/g, '')
      }),
    })
      .then(response => response.json())
      .then(data => {
        setIsSubmitting(false);
        if (data.success) {
          setIsPhoneVerified(true);
          onNext(); // Move to next step when verification is successful
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
    <div className="onboarding-step phone-step">
      <h2>Add your phone number</h2>
      <p>This allows you to manage tasks via SMS.</p>

      {!verificationSent ? (
        <>
          <div className="form-field">
            <input
              type="tel"
              className="phone-input"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                setError('');
              }}
              placeholder="+1 (XXX) XXX-XXXX"
              disabled={isSubmitting}
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <button 
            className="primary-button"
            onClick={sendVerificationCode}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Sending...' : 'Send Code'}
          </button>
        </>
      ) : (
        <>
          <p className="verification-instructions">
            Enter the 6-digit verification code sent to <strong>{phoneNumber}</strong>
          </p>
          <div className="form-field">
            <input
              type="text"
              className="verification-code-input"
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
              }}
              placeholder="123456"
              maxLength="6"
              disabled={isSubmitting}
            />
            {error && <div className="error-message">{error}</div>}
          </div>

          <div className="button-group">
            <button 
              className="primary-button"
              onClick={verifyCode}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Verifying...' : 'Verify'}
            </button>
            
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
          </div>
        </>
      )}
    </div>
  );
}

/* ========================================
   Birthday Step Component 
======================================== */
function BirthdayStep({ birthday, setBirthday, onNext, onComplete }) {
  const [error, setError] = useState('');

  const handleContinue = () => {
    if (!birthday) {
      setError('Please enter your birthday');
      return;
    }
    
    // Basic validation for date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(birthday)) {
      setError('Please use the date picker or enter a valid date (YYYY-MM-DD)');
      return;
    }
    
    // Submit all data and complete onboarding
    onComplete();
  };

  return (
    <div className="onboarding-step birthday-step">
      <h2>When's your birthday?</h2>
      <p>We'll use this to celebrate with you!</p>
      
      <div className="form-field">
        <input
          type="date"
          value={birthday}
          onChange={(e) => {
            setBirthday(e.target.value);
            setError('');
          }}
          className={error ? 'error' : ''}
        />
        {error && <div className="error-message">{error}</div>}
      </div>

      <button 
        className="primary-button"
        onClick={handleContinue}
      >
        Complete Setup
      </button>
    </div>
  );
}

/* ========================================
   Main Onboarding Component
======================================== */
function Onboarding({ user, setUser }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [firstName, setFirstName] = useState(user?.given_name || '');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [birthday, setBirthday] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  
  const totalSteps = 3; // Name, Phone, Birthday

  const nextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  const completeOnboarding = () => {
    setIsSubmitting(true);
    
    // Update user profile with all collected information
    fetch(`${API_BASE_URL}/api/complete-onboarding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.sub || user.email,
        firstName,
        phoneNumber: phoneNumber.replace(/\s+/g, ''),
        phoneVerified: isPhoneVerified,
        birthday,
        onboardingCompleted: true
      }),
    })
      .then(response => response.json())
      .then(data => {
        setIsSubmitting(false);
        if (data.success) {
          // Update the user object to include onboarding status
          const updatedUser = {
            ...user,
            onboardingCompleted: true
          };
          
          // Save updated user to localStorage and state
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);
          
          // Navigate to dashboard
          navigate('/dashboard');
        } else {
          console.error('Onboarding completion failed:', data.error);
          // Show error message to user
        }
      })
      .catch(err => {
        console.error('Error completing onboarding:', err);
        setIsSubmitting(false);
        // Show error message to user
      });
  };

  // Render the current step
  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <NameStep 
            firstName={firstName}
            setFirstName={setFirstName}
            onNext={nextStep}
          />
        );
      case 1:
        return (
          <PhoneStep 
            userId={user?.sub || user?.email}
            phoneNumber={phoneNumber}
            setPhoneNumber={setPhoneNumber}
            setIsPhoneVerified={setIsPhoneVerified}
            onNext={nextStep}
          />
        );
      case 2:
        return (
          <BirthdayStep 
            birthday={birthday}
            setBirthday={setBirthday}
            onNext={nextStep}
            onComplete={completeOnboarding}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="onboarding-container">
      <div className="onboarding-card">
        <StepIndicator currentStep={currentStep} totalSteps={totalSteps} />
        {renderStep()}
      </div>
    </div>
  );
}

export default Onboarding;