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
import SkillDevelopment from "./pages/SkillDevelopment";

// ...imports above stay
// import Courses from "./pages/Courses";
// import CourseNew from "./pages/CourseNew";
// import CourseDetails from "./pages/CourseDetails";
// import MyCourses from "./pages/MyCourses";
// import CoursePlayer from "./pages/CoursePlayer";

// add imports at the top with others
import Feed from "./pages/Feed";
import UserPublicProfile from "./pages/UserPublicProfile";
import { DMList, DMChat } from "./pages/DirectMessages";
import People from "./pages/People";


import Courses from "./pages/Courses";
import CourseCreate from "./pages/CourseCreate";
import CourseView from "./pages/CourseView";
import MyCourses from "./pages/MyCourses";

// ...rest unchanged

// in <Routes> add:

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
          user.role === "worker" ? "/freelancer" :
            user.role === "admin" ? "/admin" : "/";

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

        <Route
          path="/skill-development"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["worker"]}><SkillDevelopment /></RoleRoute>
            </ProtectedRoute>
          }
        />


        <Route
          path="/feed"
          element={
            <ProtectedRoute>
              <Feed />
            </ProtectedRoute>
          }
        />
        <Route
          path="/u/:id"
          element={
            <ProtectedRoute>
              <UserPublicProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dm"
          element={
            <ProtectedRoute>
              <DMList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dm/:userId"
          element={
            <ProtectedRoute>
              <DMChat />
            </ProtectedRoute>
          }
        />

        <Route
          path="/people"
          element={
            <ProtectedRoute>
              <People />
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

        <Route path="/courses" element={<Courses />} />
        <Route
          path="/courses/create"
          element={
            <ProtectedRoute>
              <RoleRoute allow={["worker"]}><CourseCreate /></RoleRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/courses/:id"
          element={
            <ProtectedRoute>
              <CourseView />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my/courses"
          element={
            <ProtectedRoute>
              <MyCourses />
            </ProtectedRoute>
          }
        />
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
