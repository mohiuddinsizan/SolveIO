import { useState } from "react";
import api from "../lib/api";
import { useAuth } from "../store/auth";
import "../styles/forms.css";

export default function Signup() {
    const setAuth = useAuth(s => s.setAuth);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("worker");
    const [err, setErr] = useState("");

    const onSubmit = async (e) => {
        e.preventDefault();
        setErr("");
        try {
            const res = await api.post("/auth/register", { name, email, password, role });
            setAuth(res.data);
            const r = res.data?.user?.role;
            if (r === "employer") window.location.href = "/employer";
            else if (r === "worker") window.location.href = "/freelancer";
            else window.location.href = "/";
        } catch (e) {
            setErr(e?.response?.data?.error || "Signup failed");
        }
    };



    return (
        <div className="auth-wrapper">
            <div className="panel auth-card">
                <h2 className="h2 form-title">Create account</h2>
                {err && <div className="error">{err}</div>}
                <form className="form" onSubmit={onSubmit}>
                    <input className="input" placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
                    <input className="input" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                    <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />

                    {/* Admin removed here */}
                    <select className="select" value={role} onChange={e => setRole(e.target.value)}>
                        <option value="worker">Freelancer</option>
                        <option value="employer">Employer</option>
                    </select>

                    <button className="btn btn-primary">Sign up</button>
                </form>
            </div>
        </div>
    );
}
