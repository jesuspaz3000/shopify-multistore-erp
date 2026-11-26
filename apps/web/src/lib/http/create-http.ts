import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { toApiError } from './errors';

export type Http = ReturnType<typeof createHttp>;

/**
 * Envuelve una instancia de axios con métodos tipados que devuelven directamente los datos
 * y lanzan siempre ApiError. Es el ÚNICO lugar con lógica de axios.
 */
export function createHttp(instance: AxiosInstance) {
  const request = async <T>(config: AxiosRequestConfig): Promise<T> => {
    try {
      const { data } = await instance.request<T>(config);
      return data;
    } catch (error) {
      throw toApiError(error);
    }
  };

  return {
    get: <T>(url: string, params?: object) => request<T>({ method: 'GET', url, params }),
    post: <T>(url: string, body?: unknown) => request<T>({ method: 'POST', url, data: body }),
    put: <T>(url: string, body?: unknown) => request<T>({ method: 'PUT', url, data: body }),
    patch: <T>(url: string, body?: unknown) => request<T>({ method: 'PATCH', url, data: body }),
    delete: <T>(url: string) => request<T>({ method: 'DELETE', url }),
  };
}
