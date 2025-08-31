import React from "react";

export default function SmartQueuePagination({ page, setPage, total, pageSize }) {
  return (
    <div className="flex justify-between items-center mt-4 text-sm">
      <button
        onClick={() => setPage((p) => Math.max(1, p - 1))}
        className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
      >
        Prev
      </button>
      <span>
        Page {page} of {Math.ceil(total / pageSize)}
      </span>
      <button
        onClick={() => setPage((p) => (p * pageSize < total ? p + 1 : p))}
        className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700"
      >
        Next
      </button>
    </div>
  );
}
