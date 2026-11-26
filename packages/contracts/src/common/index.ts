// Contratos comunes a todos los dominios.

// Cuerpo de error que devuelve la API (formato estándar de NestJS).
export type ApiErrorBody = {
  statusCode: number;
  message: string | string[];
  error?: string;
  errorCode?: string;
};
