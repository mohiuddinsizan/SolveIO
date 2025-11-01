import { Navigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function ProtectedRoute({ children }) {
  const { token, user } = useAuth();

  // Not logged in at all
  if (!token && !user) return <Navigate to="/login" replace />;

  // If token exists but user null, let pages call refreshMe; render a minimal shell
  if (token && !user) return <div className="container">Loading…</div>;

  return children;
}
