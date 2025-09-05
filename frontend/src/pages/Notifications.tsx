import React from 'react';
import { useNotifications } from '../providers/NotificationProvider';

export const Notifications: React.FC = () => {
  const { notifications, markAsRead, dismissNotification } = useNotifications();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <span className="text-sm text-gray-500">{notifications.length} total</span>
      </div>
      
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center">
            <p className="text-gray-500">No notifications</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div key={notification.id} className="bg-white p-4 rounded-lg shadow flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold">{notification.title}</h3>
                <p className="text-gray-600 text-sm">{notification.message}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(notification.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => markAsRead(notification.id)}
                  className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded"
                  disabled={notification.status === 'read'}
                >
                  {notification.status === 'read' ? 'Read' : 'Mark Read'}
                </button>
                <button
                  onClick={() => dismissNotification(notification.id)}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};