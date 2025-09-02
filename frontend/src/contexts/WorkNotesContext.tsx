import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// ---------------------------------
// 1. Type Definitions
// ---------------------------------

export interface WorkNote {
  id: string;
  related_entity_type: "incident" | "problem" | "change" | "maintenance" | "other";
  related_entity_id: string;       // FK → Incident/Problem/Change/Maintenance
  author_user_id: string;          // FK → UsersContext
  note: string;
  visibility: "internal" | "restricted" | "public"; // internal ops vs limited vs public
  created_at: string;

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface WorkNotesContextType {
  workNotes: WorkNote[];
  addWorkNote: (note: WorkNote) => void;
  updateWorkNote: (note: WorkNote) => void;
  deleteWorkNote: (id: string) => void;
  refreshWorkNotes: () => Promise<void>;
}

const WorkNotesContext = createContext<WorkNotesContextType | undefined>(
  undefined
);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const WorkNotesProvider = ({ children }: { children: ReactNode }) => {
  const [workNotes, setWorkNotes] = useState<WorkNote[]>([]);

  const refreshWorkNotes = async () => {
    // TODO: Load from IndexedDB + sync with Postgres
  };

  const addWorkNote = (note: WorkNote) => {
    setWorkNotes((prev) => [...prev, note]);
    // TODO: Persist
  };

  const updateWorkNote = (note: WorkNote) => {
    setWorkNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
    // TODO: Persist
  };

  const deleteWorkNote = (id: string) => {
    setWorkNotes((prev) => prev.filter((n) => n.id !== id));
    // TODO: Delete
  };

  useEffect(() => {
    refreshWorkNotes();
  }, []);

  return (
    <WorkNotesContext.Provider
      value={{ workNotes, addWorkNote, updateWorkNote, deleteWorkNote, refreshWorkNotes }}
    >
      {children}
    </WorkNotesContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const useWorkNotes = () => {
  const ctx = useContext(WorkNotesContext);
  if (!ctx) throw new Error("useWorkNotes must be used within WorkNotesProvider");
  return ctx;
};

export const useEntityWorkNotes = (entityId: string, entityType: WorkNote["related_entity_type"]) => {
  const { workNotes } = useWorkNotes();
  return workNotes.filter((n) => n.related_entity_id === entityId && n.related_entity_type === entityType);
};