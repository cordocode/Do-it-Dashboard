import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { useNavigate } from 'react-router-dom';
import './css/global.css';
import './css/landing_page.css';
import './css/profile_page.css';
import './css/the_box.css';
import './css/time.css';

const ClientID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

function TypewriterText() {
  const [displayText, setDisplayText] = useState('');
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
  const [isWaiting, setIsWaiting] = useState(false);
  const [completedCycle, setCompletedCycle] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionOpacity, setTransitionOpacity] = useState(1);
  const [transitionStep, setTransitionStep] = useState(0);
  const containerRef = useRef(null);
  
  // Messages to display in sequence
  const messages = [
    "Hey there.",
    "I'm Buddy, your personal assistant.",
    "After logging in, click on your profile to add your name and number.",
    "Once verified, you can manage tasks via texting or on the dashboard.",
    "Looking forward to hearing from you!"
  ];
  
  // Typing speed with human-like patterns
  const getTypingSpeed = useCallback((text, position) => {
    const baseSpeed = 80;
    
    if (position === 0) {
      return baseSpeed + 40;
    }
    
    const currentChar = text.charAt(position - 1) || '';
    const nextChar = text.charAt(position) || '';
    
    if (/[\s,.?!;:]/.test(currentChar)) {
      return baseSpeed + 60;
    } else if (/[asdfjkl;]/.test(currentChar) && /[qweruiop]/.test(nextChar)) {
      return baseSpeed + 30;
    } else if (/[asdfjkl;]/.test(currentChar) && /[zxcvbnm,.]/.test(nextChar)) {
      return baseSpeed + 25;
    } else if (currentChar === nextChar) {
      return baseSpeed - 20;
    } else if (/[th]/.test(currentChar) && /[he]/.test(nextChar)) {
      return baseSpeed - 15;
    }
    
    return baseSpeed + Math.floor(Math.random() * 20) - 10;
  }, []);
  
  // Pauses between messages
  const pauseBeforeTransition = 1600;
  const firstMessagePause = 3000;
  const transitionDuration = 400; // Fade transition duration in ms
  
  useEffect(() => {
    if (completedCycle) return;
    
    const currentMessage = messages[currentMessageIndex];
    
    // Handle the fade transition between messages
    if (transitioning) {
      const timeout = setTimeout(() => {
        // Move through transition steps (1-10)
        const newStep = transitionStep + 1;
        setTransitionStep(newStep);
        
        if (newStep <= 5) {
          // Fade out (steps 1-5)
          setTransitionOpacity(1 - (newStep * 0.2));
        } else if (newStep === 6) {
          // Switch message when fully faded out
          setDisplayText('');
          setCurrentMessageIndex(prev => prev + 1);
          setTransitionOpacity(0);
        } else if (newStep < 11) {
          // Fade in (steps 7-10)
          setTransitionOpacity((newStep - 6) * 0.25);
        } else {
          // Transition complete - reset
          setTransitioning(false);
          setTransitionStep(0);
          setTransitionOpacity(1);
        }
      }, transitionDuration / 10);
      
      return () => clearTimeout(timeout);
    }

    // Standard typing animation
    const timeout = setTimeout(() => {
      if (!isWaiting) {
        if (displayText.length < currentMessage.length) {
          // Add one character at a time
          setDisplayText(currentMessage.substring(0, displayText.length + 1));
        } else {
          // Finished typing current message
          setIsWaiting(true);
          setTimeout(() => {
            setIsWaiting(false);
            
            if (currentMessageIndex < messages.length - 1) {
              // Start transition to next message
              setTransitioning(true);
              setTransitionStep(1);
              setTransitionOpacity(0.8); // Start fade out
            } else {
              setCompletedCycle(true);
            }
          }, currentMessageIndex === 0 ? firstMessagePause : pauseBeforeTransition);
        }
      }
    }, getTypingSpeed(currentMessage, displayText.length));
    
    return () => clearTimeout(timeout);
  }, [
    displayText, 
    currentMessageIndex, 
    isWaiting, 
    completedCycle,
    transitioning,
    transitionOpacity,
    transitionStep,
    messages,
    getTypingSpeed
  ]);
  
  // Handle container width for text overflow
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        const textWidth = containerRef.current.scrollWidth;
        if (textWidth > containerRef.current.clientWidth) {
          containerRef.current.style.width = `${textWidth + 20}px`;
        }
      }
    };
    
    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, [displayText]);
  
  return (
    <div className="typewriter-container" ref={containerRef}>
      <div 
        className="typewriter-text" 
        style={{ 
          fontSize: '18px', 
          whiteSpace: 'nowrap',
          overflow: 'visible',
          marginBottom: '40px',
          opacity: transitionOpacity,
          transition: `opacity ${transitionDuration/2000}s ease-in-out`
        }}
      >
        {displayText}<span className="cursor"></span>
      </div>
    </div>
  );
}

function LoginPage({ setUser }) {
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      setTimeout(() => {
        containerRef.current.classList.add('visible');
      }, 300);
    }
    
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
  }, []);

  const handleSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      setUser(decoded);
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
    <div className="ethereal-login-container" ref={containerRef}>
      <div className="login-content">
        <TypewriterText />
        
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