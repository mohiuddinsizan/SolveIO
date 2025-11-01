import { Link } from "react-router-dom";
import { useAuth } from "../store/auth";
import "../styles/nav.css";

export default function Nav() {
  const { user, logout } = useAuth();

  return (
    <header className="nav">
      <div className="nav-inner">
        {/* <Link to="/" className="brand">SyncPmo</Link>           */}
          <Link className="link" to="/jobs">SyncPmo</Link>


        <div className="nav-actions">
          <Link className="link" to="/jobs">Marketplace</Link>

          {!user && (
            <>
              <Link className="link" to="/login">Login</Link>
              <Link className="btn btn-outline" to="/signup">Sign up</Link>
            </>
          )}

          {user?.role === "employer" && (
            <>
              <Link className="link" to="/orders/employer">My Orders</Link>
              <Link className="link" to="/me/profile-employer">Profile</Link>
              <Link className="link" to="/analytics/employer">Analytics</Link>
            </>
          )}


          {user?.role === "worker" && (
            <>
              <Link className="link" to="/orders/freelancer">My Work</Link>
              <Link className="link" to="/me/profile">Profile</Link>
              <Link className="link" to="/analytics/freelancer">Analytics</Link>
            </>
          )}

          {user?.role === "admin" && (
            <>
              <Link className="link" to="/me/profile-admin">Profile</Link>
              <Link className="link" to="/analytics/admin">Analytics</Link>
            </>
          )}

          {user && (
            <button onClick={logout} className="btn btn-outline">Logout</button>
          )}
        </div>
      </div>
    </header>
  );
}
