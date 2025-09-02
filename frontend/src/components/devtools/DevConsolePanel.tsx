import React, { useState } from "react";
import { useReseedDB } from "../hooks/useReseedDB";
import { useSync } from "../providers/SyncProvider";


// REACT_APP_SHOW_DEVCONSOLE=true
// REACT_APP_DEVCONSOLE_KEY=myS3cretKey

const statusColors: Record<string, string> = {
  idle: "bg-green-100 text-green-800",
  syncing: "bg-yellow-100 text-yellow-800 animate-pulse",
  error: "bg-red-100 text-red-800",
};

export const DevConsolePanel = () => {
  const showDevConsole =
    process.env.NODE_ENV !== "production" ||
    process.env.REACT_APP_SHOW_DEVCONSOLE === "true";

  if (!showDevConsole) return null;

  const secretKey = process.env.REACT_APP_DEVCONSOLE_KEY || "letmein";
  const [unlocked, setUnlocked] = useState(false);
  const [attempt, setAttempt] = useState("");

  if (!unlocked) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <h3 className="text-lg font-bold mb-2">🔒 Dev Console Locked</h3>
        <input
          type="password"
          placeholder="Enter dev console key"
          value={attempt}
          onChange={(e) => setAttempt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (attempt === secretKey) {
                setUnlocked(true);
              } else {
                alert("❌ Invalid key");
              }
            }
          }}
          className="border p-2 rounded w-full"
        />
      </div>
    );
  }

  const { loading, lastAction, resetDB, seedDB, reseedDB } = useReseedDB();
  const { syncStatuses, forceSync, reseedAndSync } = useSync();

  return (
    <div className="p-4 border rounded bg-gray-50 space-y-4">
      <h3 className="text-lg font-bold">⚙️ Dev Console (Unlocked)</h3>

      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={resetDB}
          disabled={loading}
          className="px-3 py-1 bg-red-500 text-white rounded"
        >
          Reset DB
        </button>
        <button
          onClick={seedDB}
          disabled={loading}
          className="px-3 py-1 bg-green-500 text-white rounded"
        >
          Seed DB
        </button>
        <button
          onClick={reseedDB}
          disabled={loading}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          Reseed DB
        </button>
      </div>
      {lastAction && (
        <p className="text-sm text-gray-600">Last action: {lastAction}</p>
      )}

      {/* Sync Status Table */}
      <div>
        <h4 className="font-semibold mb-2">🔄 Sync Status</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-2 py-1 text-left">Store</th>
                <th className="border px-2 py-1 text-left">Status</th>
                <th className="border px-2 py-1 text-left">Pending</th>
                <th className="border px-2 py-1 text-left">Last Synced</th>
                <th className="border px-2 py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(syncStatuses).map((s) => (
                <tr key={s.store}>
                  <td className="border px-2 py-1 font-mono">{s.store}</td>
                  <td className="border px-2 py-1">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        statusColors[s.status] || "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="border px-2 py-1">{s.pending ?? 0}</td>
                  <td className="border px-2 py-1">
                    {s.lastSynced
                      ? new Date(s.lastSynced).toLocaleTimeString()
                      : "—"}
                  </td>
                  <td className="border px-2 py-1 text-center">
                    <button
                      className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                      onClick={() => forceSync(s.store)}
                    >
                      Sync
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={reseedAndSync}
          >
            Reseed + Sync All
          </button>
        </div>
      </div>
    </div>
  );
};