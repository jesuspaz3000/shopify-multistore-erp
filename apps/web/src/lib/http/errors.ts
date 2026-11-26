import type { ApiErrorBody } from '@erp/contracts';
import { isAxiosError } from 'axios';

/** Único tipo de error que ven las features (nunca un AxiosError). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Errores de validación por campo: { email: 'Email inválido' } */
    readonly fieldErrors: Record<string, string> = {},
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (!isAxiosError(error)) return new ApiError(0, 'Ocurrió un error inesperado');
  if (!error.response) return new ApiError(0, 'No se pudo conectar con el servidor');

  const { status } = error.response;
  const body = error.response.data as Partial<ApiErrorBody> | undefined;
  const messages = Array.isArray(body?.message) ? body.message : body?.message ? [body.message] : [];

  // La API responde los errores de validación como "campo: mensaje".
  const fieldErrors: Record<string, string> = {};
  const general: string[] = [];
  for (const message of messages) {
    const separator = message.indexOf(': ');
    if (status === 400 && separator > 0) fieldErrors[message.slice(0, separator)] ??= message.slice(separator + 2);
    else general.push(message);
  }

  const fallback = Object.keys(fieldErrors).length > 0 ? 'Revisa los campos marcados' : 'Ocurrió un error inesperado';
  return new ApiError(status, general[0] ?? fallback, fieldErrors, body?.errorCode);
}
