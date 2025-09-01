import React from "react";
import { useToast } from "../../contexts/ToastContext.jsx";

/**
 * ToastContainer
 * Renders global toast notifications
 * - Positioned bottom-right
 * - Auto-dismiss support
 * - Different styles per type (success, error, info, warning)
 */
export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm flex items-center justify-between
            ${
              toast.type === "error"
                ? "bg-red-600 text-white"
                : toast.type === "success"
                ? "bg-green-600 text-white"
                : toast.type === "warning"
                ? "bg-yellow-500 text-black"
                : "bg-gray-800 text-white"
            }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="ml-3 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}