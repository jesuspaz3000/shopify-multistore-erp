import type { ProductInput, ProductResponse, ProductStatus } from '@erp/contracts';
import { emptyFields, newUid, type OptionDraft, sortVariants, type VariantDraft } from '../variants/variant-ops';

// Estado del formulario de producto (las reglas de opciones/variantes viven en variants/variant-ops.ts).

export type ProductFormState = {
  title: string;
  description: string;
  status: ProductStatus;
  vendor: string;
  productType: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  /** URL del producto ('' al crear = se genera desde el título). */
  handle: string;
  options: OptionDraft[];
  /** Sin opciones hay exactamente una variante (precio, inventario y envío del producto). */
  variants: VariantDraft[];
  version?: number;
};

export function initialState(product?: ProductResponse): ProductFormState {
  if (!product) {
    return {
      title: '',
      description: '',
      status: 'DRAFT',
      vendor: '',
      productType: '',
      tags: [],
      seoTitle: '',
      seoDescription: '',
      handle: '',
      options: [],
      variants: [{ uid: newUid('v'), values: {}, fields: { ...emptyFields(), price: '0.00' } }],
    };
  }
  const options: OptionDraft[] = product.options.map((o) => ({
    uid: newUid('o'),
    name: o.name,
    values: o.values.map((name) => ({ uid: newUid('val'), name })),
  }));
  const variants: VariantDraft[] = product.variants.map((v) => ({
    uid: newUid('v'),
    id: v.id,
    values: Object.fromEntries(
      options.map((o, i) => [o.uid, o.values.find((x) => x.name.toLowerCase() === v.optionValues[i]?.toLowerCase())?.uid ?? '']),
    ),
    fields: {
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? '',
      cost: v.cost ?? '',
      taxable: v.taxable,
      sku: v.sku ?? '',
      barcode: v.barcode ?? '',
      tracked: v.tracked,
      inventoryPolicy: v.inventoryPolicy,
      requiresShipping: v.requiresShipping,
      weight: v.weight ?? '',
      weightUnit: v.weightUnit,
    },
  }));
  return {
    title: product.title,
    description: product.description ?? '',
    status: product.status,
    vendor: product.vendor ?? '',
    productType: product.productType ?? '',
    tags: product.tags,
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    handle: product.handle,
    options,
    variants: sortVariants(variants, options),
    version: product.version,
  };
}

/** Cuerpo para la API (lo valida productInputSchema). El orden de `variants` es el de la lista. */
export function toInput(state: ProductFormState): ProductInput {
  return {
    title: state.title,
    description: state.description,
    status: state.status,
    vendor: state.vendor,
    productType: state.productType,
    tags: state.tags,
    seoTitle: state.seoTitle,
    seoDescription: state.seoDescription,
    handle: state.handle,
    options: state.options.map((o) => ({ name: o.name, values: o.values.map((v) => v.name) })),
    variants: state.variants.map((v) => ({
      id: v.id,
      optionValues: state.options.map((o) => o.values.find((x) => x.uid === v.values[o.uid])?.name ?? ''),
      ...v.fields,
    })),
    version: state.version,
  };
}

/**
 * Errores de validación ("variants.2.price") -> por uid de variante ("v12.price"), para que sigan
 * en la variante correcta aunque la lista cambie de orden.
 */
export function mapErrors(errors: Record<string, string>, state: ProductFormState): Record<string, string> {
  return Object.fromEntries(
    Object.entries(errors).map(([path, message]) => {
      const match = /^variants\.(\d+)\.(.+)$/.exec(path);
      const variant = match ? state.variants[Number(match[1])] : undefined;
      return [variant ? `${variant.uid}.${match![2]}` : path, message];
    }),
  );
}

/** Errores de una variante: { price: '...' }. */
export function errorsOf(errors: Record<string, string>, variantUid: string): Record<string, string> {
  const prefix = `${variantUid}.`;
  return Object.fromEntries(
    Object.entries(errors)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => [k.slice(prefix.length), v]),
  );
}
