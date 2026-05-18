/**
 * Thin REST client for the ABANCOOL API.
 * Set VITE_API_URL in your .env (e.g. https://api.yourdomain.com/api).
 */
const BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
const TOKEN_KEY = "abancool.token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) =>
  t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY);

async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  loginInit: (email: string, password: string) =>
    request<{ otpRequired: true; email: string; ttlSeconds: number; devCode?: string }>(
      "/auth/login-init",
      { method: "POST", body: JSON.stringify({ email, password }) }
    ),
  verifyOtp: (email: string, code: string) =>
    request<{ user: { id: number; name: string; email: string; role: string }; token: string }>(
      "/auth/verify-otp",
      { method: "POST", body: JSON.stringify({ email, code, purpose: "login" }) }
    ),
  resendOtp: (email: string) =>
    request<{ sent: true; ttlSeconds: number; devCode?: string }>("/auth/resend-otp", {
      method: "POST",
      body: JSON.stringify({ email, purpose: "login" }),
    }),
  me: () => request<{ user: any }>("/auth/me"),
};
