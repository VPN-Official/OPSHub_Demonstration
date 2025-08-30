import React from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return <div className="bg-warning text-black p-2 text-center text-sm">⚠️ You are offline. Showing cached data.</div>;
}
