import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useKnowledge } from "../contexts/KnowledgeContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast, TOAST_TYPES } from "../contexts/ToastContext.jsx";
import { ArrowLeft, FileText, Edit3 } from "lucide-react"; // ✅ Lucide icons

/**
 * KnowledgeDetail
 * - Shows knowledge article
 * - Inline action: Edit (SMEs only)
 * - Traceability: related work item
 */
export default function KnowledgeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { articles } = useKnowledge();
  const { role } = useAuth();
  const { addToast } = useToast();

  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState("");

  const article = articles.find((a) => a.id === id);

  if (!article) {
    return <div className="p-4 text-gray-500">Knowledge article not found.</div>;
  }

  const handleEdit = () => {
    setEditing(true);
    setContent(article.content || "");
  };

  const handleSave = () => {
    // 🔧 TODO: persist updated article in context/DB
    addToast({ message: "Knowledge article updated", type: TOAST_TYPES.SUCCESS });
    setEditing(false);
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-gray-600 hover:text-blue-600"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <FileText size={20} /> {article.title}
        </h2>
      </div>

      {/* Metadata */}
      <div className="p-3 border rounded-lg bg-gray-50 text-sm flex flex-col gap-1">
        <span><strong>ID:</strong> {article.id}</span>
        {article.relatedWorkItemId && (
          <span className="text-blue-600 cursor-pointer hover:underline">
            🔗 Related WorkItem: {article.relatedWorkItemId}
          </span>
        )}
        {article.gap && <span className="text-red-600">⚠ Knowledge Gap</span>}
      </div>

      {/* Content */}
      <div className="p-3 border rounded-lg bg-white">
        <h3 className="font-semibold mb-2">Content</h3>
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              className="border p-2 rounded text-sm h-40"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1 bg-gray-200 rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-700 whitespace-pre-line">
            {article.content || "No content available."}
          </p>
        )}
      </div>

      {/* Actions (SME only) */}
      {role === "sme" && !editing && (
        <div>
          <button
            onClick={handleEdit}
            className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            <Edit3 size={16} /> Edit
          </button>
        </div>
      )}
    </div>
  );
}