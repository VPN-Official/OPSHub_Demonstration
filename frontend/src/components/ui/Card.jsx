import React from "react";

export function Card({ children, className = "" }) {
  return (
    <div
      className={`bg-[var(--card)] rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className = "" }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}