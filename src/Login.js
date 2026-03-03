import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("token", data.token);

        // Route based on role
        if (data.role === "admin") {
          navigate("/admin");
        } 
        else if (data.role === "patient") {
          navigate("/patient");
        } 
        else if (data.role === "clinician") {
          navigate("/clinician");
        } 
        else {
          navigate("/"); // fallback
        }

      } else {
        alert(data.msg || "Bad credentials");
      }

    } catch (error) {
      alert("Server error. Make sure backend is running.");
    }
  };

  return (
    <div>
      <h2>Login</h2>

      <input
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
