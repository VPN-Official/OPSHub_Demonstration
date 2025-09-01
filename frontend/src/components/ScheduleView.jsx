import React, { useState, useEffect, useMemo } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useSchedule } from "../contexts/ScheduleContext.jsx";
import { useWorkItems } from "../contexts/WorkItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useSync } from "../contexts/SyncContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { 
  Calendar, 
  Plus, 
  Wrench, 
  Plane, 
  Users, 
  Clock,
  AlertTriangle,
  CheckCircle2,
  Filter,
  RefreshCw
} from "lucide-react";

export default function IntegratedScheduleView({ role }) {
  const { schedule, addEvent, EVENT_TYPES, getFilteredEvents } = useSchedule();
  const { workItems = [] } = useWorkItems();
  const { user } = useAuth();
  const { queueChange } = useSync();
  const { addToast } = useToast();
  
  const [view, setView] = useState("dayGridMonth");
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventFilters, setEventFilters] = useState({
    shifts: true,
    maintenance: true,
    leave: true,
    workItems: true,
    myOnly: role === "Support Engineer"
  });
  const [formType, setFormType] = useState(EVENT_TYPES.MAINTENANCE);

  // Enhanced events that combine schedule and work items
  const enhancedEvents = useMemo(() => {
    let events = [];

    // Add schedule events
    if (schedule) {
      const scheduleEvents = schedule.map(event => ({
        id: `sched-${event.id}`,
        title: event.title,
        start: event.start || event.date,
        end: event.end,
        backgroundColor: getEventColor(event.type),
        borderColor: getEventColor(event.type),
        textColor: getEventTextColor(event.type),
        extendedProps: {
          ...event,
          source: "schedule",
          type: event.type,
          canEdit: canEditEvent(event, user, role),
          canDelete: canDeleteEvent(event, user, role)
        }
      }));
      
      // Apply filters
      const filteredScheduleEvents = scheduleEvents.filter(event => {
        const props = event.extendedProps;
        
        if (!eventFilters[props.type]) return false;
        
        if (eventFilters.myOnly) {
          return props.user === user?.username || 
                 props.teamId === user?.teamId ||
                 props.assignedTo === user?.id;
        }
        
        return true;
      });
      
      events = events.concat(filteredScheduleEvents);
    }

    // Add work items with due dates as events
    if (eventFilters.workItems && workItems.length) {
      const workItemEvents = workItems
        .filter(item => {
          // Only show work items with due dates or scheduled maintenance
          return item.due_date || 
                 item.type === "change" || 
                 item.type === "maintenance" ||
                 (item.slaBreached && item.priority === "P0");
        })
        .filter(item => {
          if (eventFilters.myOnly) {
            return item.assignedTo === user?.id || 
                   item.assigned_to_user_id === user?.id ||
                   item.teamId === user?.teamId;
          }
          return true;
        })
        .map(item => {
          const eventDate = item.due_date || 
                           (item.type === "change" ? item.scheduledDate : null) ||
                           (item.slaBreached ? Date.now() : null);
          
          if (!eventDate) return null;

          return {
            id: `work-${item.id}`,
            title: `${item.id}: ${item.title}`,
            start: new Date(eventDate).toISOString(),
            end: item.estimated_duration ? 
              new Date(eventDate + (item.estimated_duration * 60 * 60 * 1000)).toISOString() : 
              undefined,
            allDay: !item.estimated_duration,
            backgroundColor: getWorkItemColor(item),
            borderColor: getWorkItemColor(item),
            textColor: "#fff",
            extendedProps: {
              ...item,
              source: "workitem",
              type: "workitem",
              workItemType: item.type,
              canEdit: true,
              canDelete: false,
              urgency: item.slaBreached ? "critical" : 
                      item.priority === "P1" ? "high" : "medium"
            }
          };
        })
        .filter(Boolean);

      events = events.concat(workItemEvents);
    }

    return events;
  }, [schedule, workItems, eventFilters, user, role]);

  // Event handlers
  const handleDateClick = (arg) => {
    setSelectedDate(arg.date);
    setShowEventForm(true);
  };

  const handleEventClick = (clickInfo) => {
    const { extendedProps } = clickInfo.event;
    
    if (extendedProps.source === "workitem") {
      // Navigate to work item detail
      window.location.href = `/workitem/${extendedProps.id}`;
    } else {
      // Show event details or edit form
      showEventDetails(extendedProps);
    }
  };

  const handleEventDrop = async (dropInfo) => {
    const { extendedProps } = dropInfo.event;
    
    if (!extendedProps.canEdit) {
      dropInfo.revert();
      addToast({ 
        message: "You don't have permission to edit this event", 
        type: TOAST_TYPES.WARNING 
      });
      return;
    }

    try {
      const updates = {
        start: dropInfo.event.start.toISOString(),
        end: dropInfo.event.end?.toISOString(),
        lastModified: Date.now(),
        modifiedBy: user?.id
      };

      // Queue update for sync
      await queueChange("update_schedule_event", {
        eventId: extendedProps.id,
        ...updates,
        apiEndpoint: `/api/schedule/${extendedProps.id}`,
        method: "PUT"
      });

      addToast({ 
        message: "Event rescheduled successfully", 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      dropInfo.revert();
      addToast({ 
        message: `Failed to reschedule event: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const handleAddEvent = async (eventData) => {
    try {
      const newEvent = {
        type: formType,
        title: eventData.title,
        start: eventData.start,
        end: eventData.end,
        description: eventData.description,
        user: user?.username,
        teamId: user?.teamId,
        createdBy: user?.id,
        createdAt: Date.now(),
        relatedWorkItemId: eventData.relatedWorkItemId || null,
        approvalStatus: needsApproval(formType, user, role) ? "pending" : "approved"
      };

      await addEvent(newEvent);

      // Queue for sync
      await queueChange("create_schedule_event", {
        ...newEvent,
        apiEndpoint: "/api/schedule",
        method: "POST"
      });

      addToast({ 
        message: `${getEventTypeLabel(formType)} ${needsApproval(formType, user, role) ? "requested" : "scheduled"}`, 
        type: TOAST_TYPES.SUCCESS 
      });

      setShowEventForm(false);

    } catch (error) {
      addToast({ 
        message: `Failed to create event: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  const scheduleWorkItemMaintenance = async (workItem, maintenanceWindow) => {
    try {
      const maintenanceEvent = {
        type: EVENT_TYPES.MAINTENANCE,
        title: `Maintenance: ${workItem.title}`,
        start: maintenanceWindow.start,
        end: maintenanceWindow.end,
        description: `Scheduled maintenance for work item ${workItem.id}`,
        relatedWorkItemId: workItem.id,
        teamId: workItem.teamId || user?.teamId,
        createdBy: user?.id,
        createdAt: Date.now(),
        approvalStatus: "pending"
      };

      await addEvent(maintenanceEvent);

      await queueChange("schedule_maintenance", {
        ...maintenanceEvent,
        workItem,
        apiEndpoint: "/api/schedule/maintenance",
        method: "POST"
      });

      addToast({ 
        message: `Maintenance scheduled for ${workItem.id}`, 
        type: TOAST_TYPES.SUCCESS 
      });

    } catch (error) {
      addToast({ 
        message: `Failed to schedule maintenance: ${error.message}`, 
        type: TOAST_TYPES.ERROR 
      });
    }
  };

  // Helper functions
  const getEventColor = (type) => {
    const colors = {
      [EVENT_TYPES.SHIFT]: "#3b82f6",      // blue
      [EVENT_TYPES.MAINTENANCE]: "#f59e0b", // amber  
      [EVENT_TYPES.LEAVE]: "#10b981",       // emerald
      [EVENT_TYPES.ROSTER]: "#8b5cf6"       // violet
    };
    return colors[type] || "#6b7280";
  };

  const getEventTextColor = (type) => {
    return "#ffffff"; // All events use white text
  };

  const getWorkItemColor = (item) => {
    if (item.slaBreached) return "#dc2626"; // red
    if (item.priority === "P0") return "#ea580c"; // orange
    if (item.priority === "P1") return "#d97706"; // amber
    if (item.type === "change") return "#7c3aed"; // purple
    return "#4f46e5"; // indigo
  };

  const canEditEvent = (event, user, role) => {
    if (role === "Manager") return true;
    if (event.createdBy === user?.id) return true;
    if (event.type === EVENT_TYPES.SHIFT && event.user === user?.username) return true;
    return false;
  };

  const canDeleteEvent = (event, user, role) => {
    return canEditEvent(event, user, role);
  };

  const needsApproval = (eventType, user, role) => {
    if (role === "Manager") return false;
    if (eventType === EVENT_TYPES.MAINTENANCE) return true;
    if (eventType === EVENT_TYPES.LEAVE) return true;
    return false;
  };

  const getEventTypeLabel = (type) => {
    const labels = {
      [EVENT_TYPES.SHIFT]: "Shift",
      [EVENT_TYPES.MAINTENANCE]: "Maintenance",
      [EVENT_TYPES.LEAVE]: "Leave Request",
      [EVENT_TYPES.ROSTER]: "Team Event"
    };
    return labels[type] || type;
  };

  const showEventDetails = (eventProps) => {
    // For now, show a simple alert - in production this would be a modal
    const details = [
      `Title: ${eventProps.title}`,
      `Type: ${getEventTypeLabel(eventProps.type)}`,
      eventProps.description ? `Description: ${eventProps.description}` : null,
      eventProps.approvalStatus ? `Status: ${eventProps.approvalStatus}` : null,
      eventProps.relatedWorkItemId ? `Related Work Item: ${eventProps.relatedWorkItemId}` : null
    ].filter(Boolean).join('\n');
    
    alert(details);
  };

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Calendar size={20} /> Schedule
          </h2>
          <div className="text-sm text-gray-600 mt-1">
            {role} view • {enhancedEvents.length} events
          </div>
        </div>
        
        <div className="flex gap-2">
          {/* View Controls */}
          <select 
            value={view} 
            onChange={(e) => setView(e.target.value)}
            className="text-sm border rounded px-2 py-1"
          >
            <option value="dayGridMonth">Month</option>
            <option value="timeGridWeek">Week</option>
            <option value="timeGridDay">Day</option>
          </select>

          {/* Create Event Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowEventForm(true)}
              className="flex items-center gap-1 px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm"
            >
              <Plus size={14} /> Schedule
            </button>
          </div>
        </div>
      </div>

      {/* Event Filters */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
        <Filter size={16} className="text-gray-600" />
        <div className="flex flex-wrap gap-3">
          {[
            { key: "shifts", label: "Shifts", icon: Users },
            { key: "maintenance", label: "Maintenance", icon: Wrench },
            { key: "leave", label: "Leave", icon: Plane },
            { key: "workItems", label: "Work Items", icon: AlertTriangle }
          ].map(({ key, label, icon: Icon }) => (
            <label key={key} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={eventFilters[key]}
                onChange={(e) => setEventFilters(prev => ({
                  ...prev,
                  [key]: e.target.checked
                }))}
              />
              <Icon size={14} />
              {label}
            </label>
          ))}
        </div>
        
        <div className="ml-auto">
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={eventFilters.myOnly}
              onChange={(e) => setEventFilters(prev => ({
                ...prev,
                myOnly: e.target.checked
              }))}
            />
            My events only
          </label>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1 bg-white border rounded-lg shadow">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView={view}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: ''  // Controlled by our custom header
          }}
          events={enhancedEvents}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          editable={true}
          droppable={true}
          eventDrop={handleEventDrop}
          height="auto"
          dayMaxEvents={3}
          moreLinkClick="popover"
          eventDisplay="block"
          displayEventTime={view !== "dayGridMonth"}
          nowIndicator={true}
          businessHours={{
            daysOfWeek: [1, 2, 3, 4, 5], // Monday - Friday
            startTime: '08:00',
            endTime: '18:00'
          }}
        />
      </div>

      {/* Statistics Bar */}
      <div className="flex justify-between items-center text-sm text-gray-600 pt-2 border-t">
        <div className="flex gap-4">
          <span>
            {enhancedEvents.filter(e => e.extendedProps.source === "schedule").length} scheduled events
          </span>
          <span>
            {enhancedEvents.filter(e => e.extendedProps.source === "workitem").length} work items
          </span>
          <span>
            {enhancedEvents.filter(e => e.extendedProps.urgency === "critical").length} critical
          </span>
        </div>
        <div>
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Event Creation Form */}
      {showEventForm && (
        <EventCreationModal
          selectedDate={selectedDate}
          onClose={() => setShowEventForm(false)}
          onSubmit={handleAddEvent}
          eventTypes={EVENT_TYPES}
          workItems={workItems}
          user={user}
          role={role}
        />
      )}

      {/* Quick Actions for Work Items */}
      <QuickSchedulingPanel
        workItems={workItems.filter(item => 
          !item.due_date && 
          (item.type === "change" || item.type === "maintenance") &&
          (!eventFilters.myOnly || item.assignedTo === user?.id)
        )}
        onScheduleMaintenance={scheduleWorkItemMaintenance}
        user={user}
      />
    </div>
  );
}

// Event Creation Modal
function EventCreationModal({ selectedDate, onClose, onSubmit, eventTypes, workItems, user, role }) {
  const [formData, setFormData] = useState({
    title: "",
    type: eventTypes.MAINTENANCE,
    start: selectedDate ? selectedDate.toISOString().slice(0, 16) : "",
    end: "",
    description: "",
    relatedWorkItemId: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const getRelatedWorkItems = () => {
    return workItems.filter(item => 
      item.type === "change" || 
      item.type === "maintenance" || 
      !item.due_date
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-4">Schedule Event</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value={eventTypes.MAINTENANCE}>Maintenance</option>
              <option value={eventTypes.LEAVE}>Leave Request</option>
              <option value={eventTypes.SHIFT}>Shift</option>
              <option value={eventTypes.ROSTER}>Team Event</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start
              </label>
              <input
                type="datetime-local"
                value={formData.start}
                onChange={(e) => setFormData(prev => ({ ...prev, start: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End
              </label>
              <input
                type="datetime-local"
                value={formData.end}
                onChange={(e) => setFormData(prev => ({ ...prev, end: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border rounded px-3 py-2 text-sm h-20"
            />
          </div>

          {(formData.type === eventTypes.MAINTENANCE) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Related Work Item
              </label>
              <select
                value={formData.relatedWorkItemId}
                onChange={(e) => setFormData(prev => ({ ...prev, relatedWorkItemId: e.target.value }))}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Select work item...</option>
                {getRelatedWorkItems().map(item => (
                  <option key={item.id} value={item.id}>
                    {item.id}: {item.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Schedule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Quick Scheduling Panel
function QuickSchedulingPanel({ workItems, onScheduleMaintenance, user }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!workItems.length) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className="text-yellow-600" />
          <span className="text-sm font-medium text-yellow-800">
            {workItems.length} work items need scheduling
          </span>
        </div>
        <span className="text-yellow-600">
          {isExpanded ? "−" : "+"}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {workItems.slice(0, 3).map(item => (
            <div key={item.id} className="flex items-center justify-between p-2 bg-white rounded border">
              <div className="text-sm">
                <span className="font-medium">{item.id}:</span> {item.title}
                <span className="text-gray-500 ml-2">({item.type})</span>
              </div>
              <button
                onClick={() => onScheduleMaintenance(item, {
                  start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
                  end: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString() // +2 hours
                })}
                className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-700"
              >
                Schedule
              </button>
            </div>
          ))}
          {workItems.length > 3 && (
            <div className="text-xs text-gray-500 text-center">
              +{workItems.length - 3} more items
            </div>
          )}
        </div>
      )}
    </div>
  );
}