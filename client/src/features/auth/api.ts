import { http } from '../../shared/api/httpClient';
import type { AuthUser, UserRole } from '../../shared/stores/authStore';

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function registerUser(input: {
  email: string;
  password: string;
  role: UserRole;
  displayName?: string;
  locationZip?: string;
}): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/register', input);
  return data;
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const { data } = await http.post<AuthResponse>('/auth/login', { email, password });
  return data;
}

export async function logoutUser(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await http.post('/auth/logout', { refreshToken });
  } catch {
    // Ignore — client-side logout still proceeds
  }
}

export async function fetchMe(): Promise<{ user: AuthUser }> {
  const { data } = await http.get<{ user: AuthUser }>('/auth/me');
  return data;
}
