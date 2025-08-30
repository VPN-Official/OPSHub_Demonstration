import React, { useState } from "react";

export default function CollaborationPane({ workitemId }) {
  const [comments, setComments] = useState([
    { user: "Alice", msg: "Investigating cooling system." },
    { user: "Bob", msg: "Running automation now." },
  ]);
  const [input, setInput] = useState("");

  const addComment = () => {
    if (!input.trim()) return;
    setComments([...comments, { user: "You", msg: input }]);
    setInput("");
  };

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded mt-4">
      <h2 className="font-semibold mb-2">Collaboration</h2>
      <ul className="space-y-1 text-sm mb-2">
        {comments.map((c, i) => (
          <li key={i}><strong>{c.user}:</strong> {c.msg}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          className="flex-grow p-1 border rounded text-sm"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a comment..."
        />
        <button
          onClick={addComment}
          className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
        >
          Send
        </button>
      </div>
    </div>
  );
}
