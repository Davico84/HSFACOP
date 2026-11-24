import { create } from "zustand";
import type { UserResponseRole } from "@/modules/core/services/generated/model";

/** Rol de acceso: sale del contrato (orval), así un rol mal escrito no compila. */
export type Role = UserResponseRole;

export interface SessionUser {
  id: number;
  email: string;
  role: Role;
  fullName?: string;
  /** Último día con acceso completo (fecha de Lima); nulo en cuentas ADMIN, que no vencen. */
  expiresOn?: string | null;
  /** La cuenta venció: puede ver e imprimir, no crear ni guardar (lo calcula el servidor). */
  readOnly?: boolean;
}

/**
 * Estado de sesión. El access token vive **solo en memoria** (no se persiste):
 * la restauración tras recargar se hace vía el endpoint de refresh (cookie
 * HttpOnly). Ver docs/backend.md y la decisión D1 del change add-authentication.
 */
export type SessionStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface SessionState {
  accessToken: string | null;
  user: SessionUser | null;
  status: SessionStatus;
  setSession: (accessToken: string, user: SessionUser) => void;
  setAccessToken: (accessToken: string) => void;
  setStatus: (status: SessionStatus) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  accessToken: null,
  user: null,
  status: "idle",
  setSession: (accessToken, user) => set({ accessToken, user, status: "authenticated" }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, user: null, status: "unauthenticated" }),
}));
