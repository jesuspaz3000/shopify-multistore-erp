import { trimDecimal } from './products.service.js';

describe('trimDecimal', () => {
  it('muestra montos con 2 decimales o sin decimales si es entero', () => {
    expect(trimDecimal('19.9000')).toBe('19.90');
    expect(trimDecimal('20.0000')).toBe('20');
    expect(trimDecimal('0.5000')).toBe('0.50');
  });

  it('conserva hasta 4 decimales cuando son significativos', () => {
    expect(trimDecimal('1.2345')).toBe('1.2345');
    expect(trimDecimal('1.2340')).toBe('1.234');
  });
});
