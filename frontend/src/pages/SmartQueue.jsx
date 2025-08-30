import React, { useEffect, useState } from "react";
import SmartQueueCard from "../components/SmartQueueCard";
import SmartQueueRow from "../components/SmartQueueRow";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useNotifications } from "../context/NotificationsContext";

export default function SmartQueue() {
  const [workitems, setWorkitems] = useState([
    { id: 1, title: "Cooling failure in DCN1", priority: "priority_1", sla_target_minutes: 60 },
    { id: 2, title: "Patch update pending", priority: "priority_2", sla_target_minutes: 180 }
  ]);
  const isMobile = window.innerWidth < 768;
  const isOnline = useOnlineStatus();
  const { setNotifications } = useNotifications();

  useEffect(() => {
    if (isOnline) setNotifications(prev => [...prev, "Fetched Smart Queue"]);
    else setNotifications(prev => [...prev, "Offline mode - showing cache"]);
  }, [isOnline]);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Smart Queue</h1>
      {isMobile ? (
        workitems.map(wi => <SmartQueueCard key={wi.id} workitem={wi} />)
      ) : (
        <table className="w-full text-sm"><tbody>
          {workitems.map(wi => <SmartQueueRow key={wi.id} workitem={wi} />)}
        </tbody></table>
      )}
    </div>
  );
}
