import { Navigate } from "react-router-dom";
import { useAuth } from "../store/auth";

export default function RoleRoute({ allow = [], children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (!allow.includes(user.role)) {
    // send to their correct dashboard instead of blanking
    const fallback =
      user.role === "admin" ? "/admin" :
      user.role === "employer" ? "/employer" :
      user.role === "worker" ? "/freelancer" : "/";
    return <Navigate to={fallback} replace />;
  }

  return children;
}
