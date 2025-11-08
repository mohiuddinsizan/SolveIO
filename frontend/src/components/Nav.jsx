import { useEffect, useState, useMemo, useRef } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../store/auth";
import { apiDMConversations } from "../lib/api";
import { getUnreadFromConvos } from "../lib/dmRead";
import "../styles/nav.css";

const idOf = (v) => (v && typeof v === "object" ? v._id || v.id || null : v || null);
const sid = (v) => (v == null ? "" : String(v));

export default function Nav() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const myId = useMemo(() => sid(idOf(user?._id) || idOf(user?.id)), [user]);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // dropdown state
  const [openDropdown, setOpenDropdown] = useState(null); // 'courses' | 'social' | 'profile' | null
  const navRef = useRef(null);

  const toggleMenu = () => setIsMenuOpen(v => !v);
  const closeMenu = () => {
    setIsMenuOpen(false);
    setOpenDropdown(null);
  };

  const toggleDropdown = (key) => {
    setOpenDropdown(prev => (prev === key ? null : key));
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target)) setOpenDropdown(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // DM unread polling
  useEffect(() => {
    if (!user) { setUnread(0); return; }

    let timer;
    const tick = async () => {
      try {
        const convos = await apiDMConversations();
        setUnread(getUnreadFromConvos(convos, myId));
      } catch { /* ignore */ }
    };

    tick();
    timer = setInterval(tick, 12000);
    const onVis = () => { if (document.visibilityState === "visible") tick(); };
    document.addEventListener("visibilitychange", onVis);

    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [user, myId]);

  // recompute after navigating (e.g., you open/close a chat), and close dropdowns
  useEffect(() => {
    setOpenDropdown(null);
    if (!user) return;
    (async () => {
      try {
        const convos = await apiDMConversations();
        setUnread(getUnreadFromConvos(convos, myId));
      } catch {}
    })();
  }, [loc.pathname, user, myId]);

  const isWorker = user?.role === "worker";
  const isEmployer = user?.role === "employer";
  const isAdmin = user?.role === "admin";

  return (
    <header className="nav" ref={navRef}>
      <div className="nav-inner">
        {/* Brand */}
        <Link to="/jobs" className="brand" onClick={closeMenu} aria-label="SyncPmo Home">
          <span className="brand-inner">
            <img className="brand-logo" src="/logo.png" alt="SyncPmo" />
            <span className="brand-text">SyncPmo</span>
          </span>
        </Link>

        {/* Mobile toggle */}
        <button
          className="menu-toggle"
          onClick={toggleMenu}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}
          aria-controls="main-nav"
        >
          <span className={`hamburger-icon ${isMenuOpen ? "open" : ""}`}></span>
        </button>

        {/* Actions */}
        <nav id="main-nav" className={`nav-actions ${isMenuOpen ? "open" : ""}`} role="navigation">
          {/* Primary */}
          <NavLink to="/jobs" end className={({isActive}) => `link ${isActive ? "active" : ""}`} onClick={closeMenu}>
            Marketplace
          </NavLink>

          {/* Course Manager (dropdown) */}
          {user && (
            <div className="dropdown">
              <button
                className="link dropdown-trigger"
                aria-haspopup="menu"
                aria-expanded={openDropdown === "courses"}
                onClick={() => toggleDropdown("courses")}
              >
                Course Manager
                <span className={`chev ${openDropdown === "courses" ? "up" : ""}`} />
              </button>
              <div className={`dropdown-menu ${openDropdown === "courses" ? "open" : ""}`} role="menu">
                <NavLink to="/courses" end className="dropdown-item" onClick={closeMenu}>
                  Courses
                </NavLink>
                {isWorker && (
                  <NavLink to="/courses/create" className="dropdown-item" onClick={closeMenu}>
                    Create Course
                  </NavLink>
                )}
                <NavLink to="/my/courses" className="dropdown-item" onClick={closeMenu}>
                  My Courses
                </NavLink>
              </div>
            </div>
          )}

          {/* Social (dropdown) */}
          {user && (
            <div className="dropdown">
              <button
                className="link dropdown-trigger"
                aria-haspopup="menu"
                aria-expanded={openDropdown === "social"}
                onClick={() => toggleDropdown("social")}
              >
                Social
                {unread > 0 && <span className="nav-badge" style={{ marginLeft: 6 }}>{unread > 99 ? "99+" : unread}</span>}
                <span className={`chev ${openDropdown === "social" ? "up" : ""}`} />
              </button>
              <div className={`dropdown-menu ${openDropdown === "social" ? "open" : ""}`} role="menu">
                <NavLink to="/feed" end className="dropdown-item" onClick={closeMenu}>
                  Newsfeed
                </NavLink>
                <NavLink to="/dm" end className="dropdown-item nav-badge-wrap" onClick={closeMenu}>
                  <span>Messages</span>
                  {unread > 0 && <span className="nav-badge">{unread > 99 ? "99+" : unread}</span>}
                </NavLink>
                <NavLink to="/people" end className="dropdown-item" onClick={closeMenu}>
                  People
                </NavLink>
              </div>
            </div>
          )}

          {/* Profile (dropdown) */}
          {user && (
            <div className="dropdown">
              <button
                className="link dropdown-trigger"
                aria-haspopup="menu"
                aria-expanded={openDropdown === "profile"}
                onClick={() => toggleDropdown("profile")}
              >
                Profile
                <span className={`chev ${openDropdown === "profile" ? "up" : ""}`} />
              </button>
              <div className={`dropdown-menu ${openDropdown === "profile" ? "open" : ""}`} role="menu">
                {isWorker && (
                  <NavLink to="/skill-development" className="dropdown-item" onClick={closeMenu}>
                    Skill Development
                  </NavLink>
                )}

                {/* Profile paths differ per role */}
                {isEmployer && (
                  <NavLink to="/me/profile-employer" className="dropdown-item" onClick={closeMenu}>
                    Profile
                  </NavLink>
                )}
                {isWorker && (
                  <NavLink to="/me/profile" className="dropdown-item" onClick={closeMenu}>
                    Profile
                  </NavLink>
                )}
                {isAdmin && (
                  <NavLink to="/me/profile-admin" className="dropdown-item" onClick={closeMenu}>
                    Profile
                  </NavLink>
                )}

                {/* Analytics per role */}
                {isEmployer && (
                  <NavLink to="/analytics/employer" className="dropdown-item" onClick={closeMenu}>
                    Analytics
                  </NavLink>
                )}
                {isWorker && (
                  <NavLink to="/analytics/freelancer" className="dropdown-item" onClick={closeMenu}>
                    Analytics
                  </NavLink>
                )}
                {isAdmin && (
                  <NavLink to="/analytics/admin" className="dropdown-item" onClick={closeMenu}>
                    Analytics
                  </NavLink>
                )}

                {/* Orders/Work quick access (optional; remove if not wanted here) */}
                {isEmployer && (
                  <NavLink to="/orders/employer" className="dropdown-item" onClick={closeMenu}>
                    My Orders
                  </NavLink>
                )}
                {isWorker && (
                  <NavLink to="/orders/freelancer" className="dropdown-item" onClick={closeMenu}>
                    My Work
                  </NavLink>
                )}
              </div>
            </div>
          )}

          {/* Auth */}
          {!user && (
            <>
              <NavLink to="/login" className={({isActive}) => `link ${isActive ? "active" : ""}`} onClick={closeMenu}>
                Login
              </NavLink>
              <NavLink to="/signup" className={({isActive}) => `btn btn-outline ${isActive ? "active" : ""}`} onClick={closeMenu}>
                Sign up
              </NavLink>
            </>
          )}

          {/* Logout */}
          {user && (
            <button onClick={() => { logout(); closeMenu(); }} className="btn btn-outline">
              Logout
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
