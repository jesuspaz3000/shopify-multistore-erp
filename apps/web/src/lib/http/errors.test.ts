import { AxiosError, AxiosHeaders } from 'axios';
import { describe, expect, it } from 'vitest';
import { toApiError } from './errors';

const axiosError = (status: number, message: string | string[]) =>
  new AxiosError('fail', 'ERR', undefined, undefined, {
    status,
    statusText: '',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { statusCode: status, message },
  });

describe('toApiError', () => {
  it('"campo: mensaje" de validación va al campo (rutas con puntos incluidas)', () => {
    const error = toApiError(axiosError(400, ['clientId: ID de cliente inválido', 'variants.2.sku: SKU repetido']));
    expect(error.fieldErrors).toEqual({ clientId: 'ID de cliente inválido', 'variants.2.sku': 'SKU repetido' });
    expect(error.message).toBe('Revisa los campos marcados');
  });

  it('un mensaje normal con dos puntos se muestra completo, no como error de campo', () => {
    const message = 'Shopify rechazó las credenciales: revisa el ID y el secreto de cliente';
    const error = toApiError(axiosError(400, message));
    expect(error.fieldErrors).toEqual({});
    expect(error.message).toBe(message);
  });
});
