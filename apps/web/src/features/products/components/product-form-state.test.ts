import { describe, expect, it } from 'vitest';
import { emptyFields } from '../variants/variant-ops';
import { initialState, toInput } from './product-form-state';

describe('toInput', () => {
  it('precio vacío = 0 (como Shopify) y stock inicial solo en variantes nuevas', () => {
    const state = initialState();
    state.title = 'Taza';
    state.variants = [
      { uid: 'nueva', values: {}, fields: { ...emptyFields(), quantities: { '3': '5', '4': '', '7': '0' } } },
      { uid: 'guardada', id: 9, values: {}, fields: { ...emptyFields(), price: '12', quantities: { '3': '8' } } },
    ];
    const [nueva, guardada] = toInput(state).variants;
    expect(nueva).toMatchObject({ price: '0', quantities: [{ locationId: 3, quantity: 5 }, { locationId: 7, quantity: 0 }] });
    expect(nueva).not.toHaveProperty('quantities.2');
    expect(guardada).toMatchObject({ id: 9, price: '12', quantities: [] });
  });
});
