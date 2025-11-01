import { useState } from "react";
import { useAuth } from "../store/auth";
import api from "../lib/api";
import "../styles/forms.css";

export default function Login() {
  // We pull setter methods and current user from Zustand store
  const { setAuth } = useAuth();

  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);

    try {
      // Send all possible keys (backend can pick which one it needs)
      const payload = {
        identifier,
        email: identifier,
        username: identifier,
        password,
      };

      const res = await api.post("/auth/login", payload);
      const data = res.data;

      // Extract token and user safely
      const token =
        data?.token ||
        data?.accessToken ||
        data?.jwt ||
        data?.data?.token;
      const user =
        data?.user ||
        data?.profile ||
        data?.data?.user;

      if (!token || !user) throw new Error("Malformed response");

      // save in store
      setAuth({ token, user });

      // redirect based on role
      const role = user.role;
      if (role === "admin") window.location.href = "/jobs";
      else if (role === "employer") window.location.href = "/jobs";
      else if (role === "worker") window.location.href = "/jobs";
      else window.location.href = "/";
    } catch (e2) {
      const message = e2?.response?.data?.error || e2?.message || "Login failed";
      setErr(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="panel auth-card">
        <h2 className="h2 form-title">Login</h2>
        {err && <div className="error">{err}</div>}

        <form className="form" onSubmit={onSubmit}>
          <input
            className="input"
            type="text"
            placeholder="Email or Admin Username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button className="btn btn-primary" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
