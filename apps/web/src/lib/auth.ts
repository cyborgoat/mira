const API_BASE = import.meta.env.VITE_MIRA_API_URL ?? "http://localhost:8000";

export type User = {
  id: string;
  email: string;
  created_at: string;
};

export type Member = {
  id: string;
  name: string;
  role: string;
  department: string;
};

export type AuthResponse = {
  user: User;
  member: Member;
};

export type MeResponse = {
  id: string;
  email: string;
  members: Member[];
};

async function authRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "include",
    ...init,
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const authApi = {
  register: (body: { email: string; password: string; name: string }) =>
    authRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  login: (body: { email: string; password: string }) =>
    authRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  logout: () =>
    authRequest<{ ok: boolean }>("/auth/logout", {
      method: "POST",
    }),

  me: () => authRequest<MeResponse>("/auth/me"),
};
