import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './login_page';
import DashboardPage from './dashboard_page';
import ProfilePage from './profile_page';

function NavigatePages() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    // Add a small delay to show loading animation
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, []);

  // Modified setUser to also save to localStorage
  const handleSetUser = (userData) => {
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('user');
    }
    setUser(userData);
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
        <Route path="/" element={
          user ? <Navigate to="/dashboard" /> : <LoginPage setUser={handleSetUser} />
        } />
        <Route 
          path="/dashboard" 
          element={user ? <DashboardPage user={user} setUser={handleSetUser} /> : <Navigate to="/" />} 
        />
        <Route 
          path="/profile" 
          element={user ? <ProfilePage user={user} setUser={handleSetUser} /> : <Navigate to="/" />} 
        />
      </Routes>
    </Router>
  );
}

export default NavigatePages;
