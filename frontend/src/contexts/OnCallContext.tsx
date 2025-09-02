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

export type OnCallRotationType =
  | "primary"
  | "secondary"
  | "manager"
  | "executive"
  | "custom";

export interface OnCallShift {
  id: string;
  user_id: string;             // FK → UsersContext
  team_id: string;             // FK → TeamsContext
  rotation: OnCallRotationType;
  start_at: string;            // ISO datetime
  end_at: string;              // ISO datetime
  is_active: boolean;
}

export interface EscalationPolicy {
  id: string;
  name: string;                // "Standard Incident Escalation"
  description?: string;
  steps: {
    delay_minutes: number;     // after how long to escalate
    notify_user_ids: string[]; // FK → UsersContext
    notify_team_ids: string[]; // FK → TeamsContext
    method: "email" | "sms" | "chat" | "phone" | "push";
  }[];
}

export interface OnCallSchedule {
  id: string;
  team_id: string;             // FK → TeamsContext
  name: string;                // "Ops Team Weekday Rotation"
  description?: string;
  timezone: string;            // e.g., "America/New_York"
  shifts: OnCallShift[];
  escalation_policy_ids: string[]; // FK → EscalationPolicy
  created_at: string;
  updated_at: string;
}

// ---------------------------------
// 2. Context Interface
// ---------------------------------

interface OnCallContextType {
  schedules: OnCallSchedule[];
  addSchedule: (s: OnCallSchedule) => void;
  updateSchedule: (s: OnCallSchedule) => void;
  deleteSchedule: (id: string) => void;
  refreshSchedules: () => Promise<void>;
}

const OnCallContext = createContext<OnCallContextType | undefined>(undefined);

// ---------------------------------
// 3. Provider
// ---------------------------------

export const OnCallProvider = ({ children }: { children: ReactNode }) => {
  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);

  const refreshSchedules = async () => {
    // TODO: Load from IndexedDB + sync with Postgres
  };

  const addSchedule = (s: OnCallSchedule) => {
    setSchedules((prev) => [...prev, s]);
    // TODO: Persist
  };

  const updateSchedule = (s: OnCallSchedule) => {
    setSchedules((prev) => prev.map((sch) => (sch.id === s.id ? s : sch)));
    // TODO: Persist update
  };

  const deleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((sch) => sch.id !== id));
    // TODO: Delete
  };

  useEffect(() => {
    refreshSchedules();
  }, []);

  return (
    <OnCallContext.Provider
      value={{ schedules, addSchedule, updateSchedule, deleteSchedule, refreshSchedules }}
    >
      {children}
    </OnCallContext.Provider>
  );
};

// ---------------------------------
// 4. Hooks
// ---------------------------------

export const useOnCallSchedules = () => {
  const ctx = useContext(OnCallContext);
  if (!ctx) throw new Error("useOnCallSchedules must be used within OnCallProvider");
  return ctx;
};

export const useOnCallScheduleDetails = (id: string) => {
  const { schedules } = useOnCallSchedules();
  return schedules.find((s) => s.id === id) || null;
};