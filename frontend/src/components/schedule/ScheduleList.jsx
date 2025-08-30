import React from "react";

export default function ScheduleList({ events }) {
  // Group by day
  const grouped = events.reduce((acc, e) => {
    const day = new Date(e.start).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([day, dayEvents]) => (
        <div key={day} className="bg-white dark:bg-gray-900 rounded p-3 shadow">
          <h2 className="font-semibold mb-2">{day}</h2>
          <ul className="space-y-1 text-sm">
            {dayEvents.map((e) => (
              <li key={e.id} className="flex justify-between">
                <span>{e.title}</span>
                <span className="text-xs text-gray-500">
                  {new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                  {new Date(e.end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
