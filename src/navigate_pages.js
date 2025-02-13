import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './login_page';
import DashboardPage from './dashboard_page';
import './components.css';

function NavigatePages() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setIsLoading(false);
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
    return <div>Loading...</div>;
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
      </Routes>
    </Router>
  );
}

export default NavigatePages;
