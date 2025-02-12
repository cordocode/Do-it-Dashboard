import React, { useState } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import LoginPage from './login_page';
import DashboardPage from './dashboard_page';

function NavigatePages() {
  const [user, setUser] = useState(null);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage setUser={setUser} />} />
        <Route 
          path="/dashboard" 
          element={user ? <DashboardPage user={user} /> : <Navigate to="/" />} 
        />
      </Routes>
    </Router>
  );
}

export default NavigatePages;
