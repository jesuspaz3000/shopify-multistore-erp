import type { LoginInput, MeResponse, RegisterInput } from '@erp/contracts';
import { http } from '@/lib/http';

// Endpoints de autenticación (Client Components). La API responde con la cookie de sesión httpOnly.

export const login = (input: LoginInput) => http.post<MeResponse>('/auth/login', input);

export const register = (input: RegisterInput) => http.post<MeResponse>('/auth/register', input);

export const logout = () => http.post<void>('/auth/logout');
