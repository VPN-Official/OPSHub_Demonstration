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

export type CommChannel = "email" | "sms" | "chat" | "portal" | "phone" | "other";

export type CommAudience =
  | "executive"
  | "business_user"
  | "customer"
  | "vendor"
  | "internal_it"
  | "other";

export interface StakeholderComm {
  id: string;
  related_entity_type: "incident" | "change" | "problem" | "maintenance" | "other";
  related_entity_id: string;      // FK to Incident/Change/Problem/Maintenance
  audience: CommAudience;
  channel: CommChannel;
  message: string;
  status: "draft" | "sent" | "failed";
  created_at: string;
  sent_at?: string | null;

  // Actor
  sender_user_id?: string | null;   // FK → UsersContext
  sender_team_id?: string | null;   // FK → TeamsContext
  automation_rule_id?: string | null; // FK → AutomationRulesContext (for automated comms)

  // Delivery metadata
  recipients: { name?: string; email?: string; phone?: string; user_id?: string }[];
  delivery_report?: { recipient: string; status: "delivered" | "bounced" | "read"; timestamp: string }[];

  // Metadata
  tags: string[];
  custom_fields?: Record<string, any>;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface StakeholderCommsContextType {
  comms: StakeholderComm[];
  addComm: (comm: StakeholderComm) => void;
  updateComm: (comm: StakeholderComm) => void;
  deleteComm: (id: string) => void;
  refreshComms: () => Promise<void>;
}

const StakeholderCommsContext = createContext<StakeholderCommsContextType | undefined>(
  undefined
);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const StakeholderCommsProvider = ({ children }: { children: ReactNode }) => {
  const [comms, setComms] = useState<StakeholderComm[]>([]);

  const refreshComms = async () => {
    // TODO: Load from IndexedDB + sync with Postgres
  };

  const addComm = (comm: StakeholderComm) => {
    setComms((prev) => [...prev, comm]);
    // TODO: Persist
  };

  const updateComm = (comm: StakeholderComm) => {
    setComms((prev) => prev.map((c) => (c.id === comm.id ? comm : c)));
    // TODO: Persist update
  };

  const deleteComm = (id: string) => {
    setComms((prev) => prev.filter((c) => c.id !== id));
    // TODO: Delete
  };

  useEffect(() => {
    refreshComms();
  }, []);

  return (
    <StakeholderCommsContext.Provider
      value={{ comms, addComm, updateComm, deleteComm, refreshComms }}
    >
      {children}
    </StakeholderCommsContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const useStakeholderComms = () => {
  const ctx = useContext(StakeholderCommsContext);
  if (!ctx) throw new Error("useStakeholderComms must be used within StakeholderCommsProvider");
  return ctx;
};

export const useStakeholderCommDetails = (id: string) => {
  const { comms } = useStakeholderComms();
  return comms.find((c) => c.id === id) || null;
};

export const useEntityComms = (entityId: string, entityType: StakeholderComm["related_entity_type"]) => {
  const { comms } = useStakeholderComms();
  return comms.filter((c) => c.related_entity_id === entityId && c.related_entity_type === entityType);
};