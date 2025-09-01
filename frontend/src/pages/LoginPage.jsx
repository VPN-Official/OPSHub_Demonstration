import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("Support Engineer");
  const [tenant, setTenant] = useState("MetaDCN");

  const handleSubmit = (e) => {
    e.preventDefault();
    login({ username, role, tenant });
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[var(--bg)]">
      <form
        onSubmit={handleSubmit}
        className="bg-[var(--card)] p-6 rounded shadow w-80 space-y-4"
      >
        <h1 className="text-xl font-bold text-center">OpsHub Login</h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-2 border rounded"
          required
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option>Support Engineer</option>
          <option>Dispatcher</option>
          <option>Manager</option>
          <option>SRE</option>
          <option>Automation Engineer</option>
        </select>

        <select
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option>MetaDCN</option>
          <option>OtherTenant</option>
        </select>

        <button
          type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded"
        >
          Login
        </button>
      </form>
    </div>
  );
}