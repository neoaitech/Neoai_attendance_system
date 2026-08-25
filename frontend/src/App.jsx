import React, { useState } from "react";
import Auth from "./components/Auth.jsx"; // Ensure casing matches your filename in src/components
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  const [user, setUser] = useState(null);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <div>
      {user ? (
        <Dashboard onLogout={handleLogout} user={user} />
      ) : (
        <Auth onAuthSuccess={handleAuthSuccess} />
      )}
    </div>
  );
}