import React, { useEffect, useState } from "react";
import Login from "./Login";
import SonarApp from "./Sonar";
import { initRipple } from "./ripple";


const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
  initRipple();
  }, []);

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem("jwt");
      if (!token) {
        setIsAuthenticated(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const res = await fetch("http://localhost:3001/verify-token", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (data.valid) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem("jwt");
          setIsAuthenticated(false);
        }
      } catch (err) {
        console.error("Token verification failed:", err);
        localStorage.removeItem("jwt");
        setIsAuthenticated(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkToken();
  }, []);

  return (
    <>
      <canvas id="ripple-canvas"></canvas>

      {checkingAuth ? (
        <div
          style={{
            color: "#60a5fa",
            fontFamily: "Inter, sans-serif",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
          }}
        >
          Checking authentication...
        </div>
      ) : isAuthenticated ? (
        <SonarApp />
      ) : (
        <Login onLogin={() => setIsAuthenticated(true)} />
      )}
    </>
  );
};

export default App;