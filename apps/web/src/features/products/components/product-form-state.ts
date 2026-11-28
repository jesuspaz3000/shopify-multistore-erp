import type { ProductInput, ProductResponse, ProductStatus, TaxonomyCategoryResponse } from '@erp/contracts';
import { emptyFields, newUid, type OptionDraft, sortVariants, type VariantDraft } from '../variants/variant-ops';

// Estado del formulario de producto (las reglas de opciones/variantes viven en variants/variant-ops.ts).

export type ProductFormState = {
  title: string;
  description: string;
  status: ProductStatus;
  vendor: string;
  productType: string;
  /** Categoría de la taxonomía estándar de Shopify (null = sin categoría). */
  category: TaxonomyCategoryResponse | null;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  /** URL del producto ('' al crear = se genera desde el título). */
  handle: string;
  /** Imágenes en orden (la primera es la principal). */
  media: { id: number; url: string; alt: string | null }[];
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
      status: 'ACTIVE',
      vendor: '',
      productType: '',
      category: null,
      tags: [],
      seoTitle: '',
      seoDescription: '',
      handle: '',
      media: [],
      options: [],
      variants: [{ uid: newUid('v'), values: {}, fields: emptyFields() }],
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
    available: v.available,
    levels: v.levels,
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
      countryCodeOfOrigin: v.countryCodeOfOrigin ?? '',
      harmonizedSystemCode: v.harmonizedSystemCode ?? '',
      quantities: {},
    },
  }));
  return {
    title: product.title,
    description: product.description ?? '',
    status: product.status,
    vendor: product.vendor ?? '',
    productType: product.productType ?? '',
    category: product.category,
    tags: product.tags,
    seoTitle: product.seoTitle ?? '',
    seoDescription: product.seoDescription ?? '',
    handle: product.handle,
    media: product.media.map(({ id, url, alt }) => ({ id, url, alt })),
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
    categoryId: state.category?.id ?? '',
    tags: state.tags,
    seoTitle: state.seoTitle,
    seoDescription: state.seoDescription,
    handle: state.handle,
    media: state.media.map(({ id, alt }) => ({ id, alt })),
    options: state.options.map((o) => ({ name: o.name, values: o.values.map((v) => v.name) })),
    variants: state.variants.map(({ id, values, fields: { quantities, ...fields } }) => ({
      id,
      optionValues: state.options.map((o) => o.values.find((x) => x.uid === values[o.uid])?.name ?? ''),
      ...fields,
      // Precio vacío = 0 (como en Shopify: el producto se guarda en 0.00).
      price: fields.price.trim() === '' ? '0' : fields.price,
      // Stock inicial solo para variantes nuevas (el de las guardadas se ajusta en Inventario).
      quantities: id
        ? []
        : Object.entries(quantities)
            .filter(([, qty]) => qty.trim() !== '')
            .map(([locationId, qty]) => ({ locationId: Number(locationId), quantity: Number(qty) })),
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
