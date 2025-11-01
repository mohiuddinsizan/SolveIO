import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./store/auth";

import Nav from "./components/Nav";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import DashboardFreelancer from "./pages/DashboardFreelancer";
import DashboardEmployer from "./pages/DashboardEmployer";
import DashboardAdmin from "./pages/DashboardAdmin";
import Marketplace from "./pages/Marketplace";
import PostJob from "./pages/PostJob";
import JobDetails from "./pages/JobDetails";
import ProfileFreelancer from "./pages/ProfileFreelancer";
import AnalyticsEmployer from "./pages/AnalyticsEmployer";
import AnalyticsFreelancer from "./pages/AnalyticsFreelancer";
import AnalyticsAdmin from "./pages/AnalyticsAdmin";
import OrdersEmployer from "./pages/OrdersEmployer";
import OrdersFreelancer from "./pages/OrdersFreelancer";
import ProfileEmployer from "./pages/ProfileEmployer";
import ProfileAdmin from "./pages/ProfileAdmin";

// If you want Bootstrap, you can re-enable these two lines. Not required.
// import "bootstrap/dist/css/bootstrap.min.css";
// import "bootstrap/dist/js/bootstrap.bundle.min.js";

function RouterBody() {
  const { user } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const publicPaths = ["/", "/login", "/signup"];
    const current = loc.pathname;

    if (user && publicPaths.includes(current)) {
      const target =
        user.role === "employer" ? "/employer" :
        user.role === "worker"   ? "/freelancer" :
        user.role === "admin"    ? "/admin" : "/";

      if (current !== target) {
        navigate(target, { replace: true });
      }
    }
  }, [user, loc.pathname, navigate]);

  return (
    <>
      <Nav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route path="/jobs" element={<Marketplace />} />
        <Route
          path="/jobs/new"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}><PostJob /></RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route path="/jobs/:id" element={<JobDetails />} />

        <Route
          path="/me/profile"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["worker"]}><ProfileFreelancer /></RoleRoute>
            </ProtectedRoute>
          }
        />

        {/* <Route
          path="/freelancer"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["worker"]}><DashboardFreelancer /></RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/employer"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}><DashboardEmployer /></RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["admin"]}><DashboardAdmin /></RoleRoute>
            </ProtectedRoute>
          }
        /> */}

        <Route
          path="/analytics/employer"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}><AnalyticsEmployer /></RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/freelancer"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["worker"]}><AnalyticsFreelancer /></RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/analytics/admin"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["admin"]}><AnalyticsAdmin /></RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/orders/employer"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}><OrdersEmployer /></RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders/freelancer"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["worker"]}><OrdersFreelancer /></RoleRoute>
            </ProtectedRoute>
          }
        />

        <Route
          path="/me/profile-employer"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["employer"]}><ProfileEmployer /></RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/me/profile-admin"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["admin"]}><ProfileAdmin /></RoleRoute>
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <RouterBody />
    </BrowserRouter>
  );
}
