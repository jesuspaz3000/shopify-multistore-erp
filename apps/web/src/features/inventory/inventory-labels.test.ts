import { describe, expect, it } from 'vitest';
import { parseAvailableInput } from './inventory-labels';

describe('parseAvailableInput', () => {
  it('"+5" y "-3" son ajustes; un número solo es la nueva cantidad', () => {
    expect(parseAvailableInput('+5')).toEqual({ delta: 5 });
    expect(parseAvailableInput(' -3 ')).toEqual({ delta: -3 });
    expect(parseAvailableInput('12')).toEqual({ quantity: 12 });
    expect(parseAvailableInput('0')).toEqual({ quantity: 0 });
  });

  it('rechaza lo que no es un entero', () => {
    for (const text of ['', 'abc', '1.5', '+0', '--2', '5+']) expect(parseAvailableInput(text)).toBeNull();
  });
});
