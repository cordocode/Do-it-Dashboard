import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './login_page';
import Onboarding from './onboarding';
import DashboardPage from './dashboard_page';
import ProfilePage from './profile_page';

// Base URL for API calls
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8080' 
  : 'https://backend.formybuddy.com';

function NavigatePages() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStatus, setOnboardingStatus] = useState(null);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      
      // Check onboarding status if we have a user
      if (parsedUser) {
        checkOnboardingStatus(parsedUser);
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // Check if user has completed onboarding
  const checkOnboardingStatus = (userData) => {
    fetch(`${API_BASE_URL}/api/user-profile?userId=${userData.sub}&email=${userData.email}`)
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setOnboardingStatus(data.profile.onboarding_completed || false);
          
          // If the profile indicates onboarding is completed, make sure it's saved in user state
          if (data.profile.onboarding_completed && !userData.onboardingCompleted) {
            const updatedUser = {
              ...userData,
              onboardingCompleted: true
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setUser(updatedUser);
          }
        }
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Error checking onboarding status:', err);
        setIsLoading(false);
      });
  };

  // Modified setUser to also save to localStorage
  const handleSetUser = (userData) => {
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      // Check onboarding status whenever user is set/updated
      checkOnboardingStatus(userData);
    } else {
      localStorage.removeItem('user');
      setUser(null);
      setOnboardingStatus(null);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Login Route */}
        <Route path="/" element={
          user 
            ? (user.onboardingCompleted 
                ? <Navigate to="/dashboard" /> 
                : <Navigate to="/onboarding" />)
            : <LoginPage setUser={handleSetUser} />
        } />

        {/* Onboarding Route */}
        <Route 
          path="/onboarding" 
          element={
            !user 
              ? <Navigate to="/" /> 
              : user.onboardingCompleted 
                ? <Navigate to="/dashboard" />
                : <Onboarding user={user} setUser={handleSetUser} />
          } 
        />
        
        {/* Dashboard Route */}
        <Route 
          path="/dashboard" 
          element={
            !user 
              ? <Navigate to="/" /> 
              : !user.onboardingCompleted 
                ? <Navigate to="/onboarding" />
                : <DashboardPage user={user} setUser={handleSetUser} />
          } 
        />
        
        {/* Profile Route */}
        <Route 
          path="/profile" 
          element={
            !user 
              ? <Navigate to="/" /> 
              : !user.onboardingCompleted 
                ? <Navigate to="/onboarding" />
                : <ProfilePage user={user} setUser={handleSetUser} />
          } 
        />
      </Routes>
    </Router>
  );
}

export default NavigatePages;