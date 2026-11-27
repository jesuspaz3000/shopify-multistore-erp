import { describe, expect, it } from 'vitest';
import {
  addVariant,
  applyOptionChange,
  emptyFields,
  groupVariants,
  type OptionDraft,
  priceSummary,
  profitAndMargin,
  type VariantDraft,
  variantLabel,
} from './variant-ops';

const opt = (uid: string, name: string, values: string[]): OptionDraft => ({
  uid,
  name,
  values: values.map((v) => ({ uid: `${uid}:${v}`, name: v })),
});
const labels = (variants: VariantDraft[], options: OptionDraft[]) => variants.map((v) => variantLabel(v, options));
const single = (): VariantDraft[] => [{ uid: 'base', id: 7, values: {}, fields: { ...emptyFields(), price: '20', sku: 'BASE' } }];

describe('applyOptionChange (comportamiento de Shopify)', () => {
  it('la primera opción convierte la variante única en la primera combinación (conserva id y datos)', () => {
    const color = opt('c', 'Color', ['Rojo', 'Azul']);
    const result = applyOptionChange([], [color], single());
    expect(labels(result, [color])).toEqual(['Rojo', 'Azul']);
    expect(result[0]).toMatchObject({ id: 7, fields: { sku: 'BASE', price: '20' } });
    // La nueva copia el precio pero no el SKU.
    expect(result[1].id).toBeUndefined();
    expect(result[1].fields).toMatchObject({ sku: '', price: '20' });
  });

  it('agregar un valor genera solo las combinaciones con ese valor', () => {
    const color = opt('c', 'Color', ['Rojo']);
    const size = opt('t', 'Talla', ['S', 'M']);
    let variants = applyOptionChange([], [color, size], single());
    expect(labels(variants, [color, size])).toEqual(['Rojo / S', 'Rojo / M']);

    // El usuario borra "Rojo / M" y luego agrega "Azul": "Rojo / M" no vuelve.
    variants = variants.filter((v) => variantLabel(v, [color, size]) !== 'Rojo / M');
    const color2 = { ...color, values: [...color.values, { uid: 'c:Azul', name: 'Azul' }] };
    variants = applyOptionChange([color, size], [color2, size], variants);
    expect(labels(variants, [color2, size])).toEqual(['Rojo / S', 'Azul / S', 'Azul / M']);
  });

  it('una opción nueva aplica su primer valor a las variantes existentes', () => {
    const color = opt('c', 'Color', ['Rojo', 'Azul']);
    let variants = applyOptionChange([], [color], single());
    const material = opt('m', 'Material', ['Algodón']);
    variants = applyOptionChange([color], [color, material], variants);
    expect(labels(variants, [color, material])).toEqual(['Rojo / Algodón', 'Azul / Algodón']);
    expect(variants[0].id).toBe(7);
  });

  it('renombrar un valor no cambia las variantes; borrar un valor borra sus variantes', () => {
    const color = opt('c', 'Color', ['Rojo', 'Azul']);
    const variants = applyOptionChange([], [color], single());
    const renamed = { ...color, values: [{ uid: 'c:Rojo', name: 'Carmesí' }, color.values[1]] };
    const afterRename = applyOptionChange([color], [renamed], variants);
    expect(afterRename.map((v) => v.uid)).toEqual(variants.map((v) => v.uid));
    expect(labels(afterRename, [renamed])).toEqual(['Carmesí', 'Azul']);

    const onlyBlue = { ...color, values: [color.values[1]] };
    expect(labels(applyOptionChange([color], [onlyBlue], variants), [onlyBlue])).toEqual(['Azul']);
  });

  it('borrar una opción junta las variantes repetidas (queda la primera)', () => {
    const color = opt('c', 'Color', ['Rojo']);
    const size = opt('t', 'Talla', ['S', 'M']);
    const variants = applyOptionChange([], [color, size], single());
    const result = applyOptionChange([color, size], [color], variants);
    expect(labels(result, [color])).toEqual(['Rojo']);
    expect(result[0].id).toBe(7);
    // Sin opciones: vuelve a una sola variante.
    expect(applyOptionChange([color], [], result)).toHaveLength(1);
  });

  it('reordenar valores reordena las variantes', () => {
    const size = opt('t', 'Talla', ['S', 'M', 'L']);
    const variants = applyOptionChange([], [size], single());
    const reordered = { ...size, values: [size.values[2], size.values[0], size.values[1]] };
    expect(labels(applyOptionChange([size], [reordered], variants), [reordered])).toEqual(['L', 'S', 'M']);
  });
});

describe('utilidades de la lista de variantes', () => {
  const color = opt('c', 'Color', ['Rojo', 'Azul']);
  const size = opt('t', 'Talla', ['S', 'M']);
  const variants = applyOptionChange([], [color, size], single());

  it('agrupa por una opción y resume precios', () => {
    const groups = groupVariants(variants, size);
    expect(groups.map((g) => [g.value.name, labels(g.variants, [color, size])])).toEqual([
      ['S', ['Rojo / S', 'Azul / S']],
      ['M', ['Rojo / M', 'Azul / M']],
    ]);
    expect(priceSummary(groups[0].variants)).toEqual({ common: '20', range: '20' });
    const mixed = [{ ...variants[0], fields: { ...variants[0].fields, price: '10' } }, variants[1]];
    expect(priceSummary(mixed)).toEqual({ common: null, range: '10 – 20' });
  });

  it('agregar una variante a mano rechaza combinaciones repetidas', () => {
    const without = variants.slice(1);
    expect(addVariant(variants, [color, size], variants[0].values)).toBeNull();
    expect(addVariant(without, [color, size], variants[0].values)).toHaveLength(4);
  });

  it('calcula ganancia y margen', () => {
    expect(profitAndMargin('20', '8')).toEqual({ profit: '12.00', margin: '60.0 %' });
    expect(profitAndMargin('20', '')).toBeNull();
  });
});
