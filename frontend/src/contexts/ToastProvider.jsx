import React from "react";
import { useToast } from "../contexts/ToastContext.jsx";

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg shadow-lg px-4 py-2 text-sm cursor-pointer transition 
          ${
            toast.type === "success"
              ? "bg-green-100 text-green-800"
              : toast.type === "error"
              ? "bg-red-100 text-red-800"
              : "bg-gray-100 text-gray-800"
          }`}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}