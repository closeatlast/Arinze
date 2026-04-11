import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import Dashboard from "./Dashboard";
import Admin from "./Admin";
import Patient from "./Patient";
import Clinician from "./Clinician";

function ProtectedRoute({ children, role }) {
  const token     = localStorage.getItem("token");
  const savedRole = localStorage.getItem("role");
  if (!token)                     return <Navigate to="/" replace />;
  if (role && savedRole !== role) return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient"
          element={
            <ProtectedRoute role="patient">
              <Patient />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clinician"
          element={
            <ProtectedRoute role="clinician">
              <Clinician />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
