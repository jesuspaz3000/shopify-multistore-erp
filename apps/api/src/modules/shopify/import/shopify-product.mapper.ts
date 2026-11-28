import { DEFAULT_VARIANT_TITLE, type ProductInput, type ProductStatus, type WeightUnit } from '@erp/contracts';

// Traducción PURA de un producto del Admin API de Shopify al formulario de producto del ERP.
// El resultado se valida con productInputSchema (las mismas reglas que al guardar a mano).

export type ShopifyVariantNode = {
  id: string;
  title: string;
  sku: string | null;
  price: string;
  compareAtPrice: string | null;
  inventoryPolicy: string;
  taxable: boolean;
  position: number;
  barcodes: { nodes: { value: string }[] };
  selectedOptions: { name: string; value: string }[];
  inventoryItem: {
    id: string;
    tracked: boolean;
    requiresShipping: boolean;
    unitCost: { amount: string } | null;
    countryCodeOfOrigin: string | null;
    harmonizedSystemCode: string | null;
    measurement: { weight: { value: number; unit: string } | null } | null;
  };
};

export type ShopifyMediaNode = {
  id: string;
  alt: string | null;
  mediaContentType: string;
  image?: { url: string; width: number | null; height: number | null } | null;
};

export type ShopifyProductNode = {
  id: string;
  handle: string;
  title: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  /** Categoría de la taxonomía estándar (null = sin categoría). */
  category?: { id: string } | null;
  status: string;
  tags: string[];
  updatedAt: string;
  seo: { title: string | null; description: string | null };
  options: { name: string; position: number; optionValues: { name: string; hasVariants: boolean }[] }[];
  media: { nodes: ShopifyMediaNode[] };
};

const STATUS: Record<string, ProductStatus> = {
  ACTIVE: 'ACTIVE',
  UNLISTED: 'ACTIVE', // activo pero oculto en la tienda: en el ERP sigue vendible
  DRAFT: 'DRAFT',
  ARCHIVED: 'ARCHIVED',
};
const WEIGHT_UNITS: readonly string[] = ['GRAMS', 'KILOGRAMS', 'OUNCES', 'POUNDS'];
const HANDLE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DECIMAL = /^\d{1,14}(\.\d{1,4})?$/;

const text = (value: string | null | undefined, max: number) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
};

/** "19.9900" -> "19.99"; descarta montos que el ERP no acepta (negativos o con más de 4 decimales). */
function money(value: string | null | undefined): string | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  const formatted = String(Number(n.toFixed(4)));
  return DECIMAL.test(formatted) ? formatted : null;
}

/** ¿Producto sin opciones? Shopify lo representa con la opción "Title" = "Default Title". */
export function isDefaultOnly(product: Pick<ShopifyProductNode, 'options'>): boolean {
  return (
    product.options.length === 1 &&
    product.options[0].optionValues.length === 1 &&
    product.options[0].optionValues[0].name === DEFAULT_VARIANT_TITLE
  );
}

/**
 * Producto de Shopify -> datos del formulario del ERP.
 * - `variantIds`: variantes del ERP ya vinculadas (por GID de Shopify) para conservarlas al reimportar.
 * - `mediaIds`: imágenes ya guardadas en el ERP (por GID de Shopify), en el orden de Shopify.
 * Devuelve también los avisos de datos que se omitieron.
 */
export function toProductInput(
  product: ShopifyProductNode,
  variants: ShopifyVariantNode[],
  variantIds: Map<string, number>,
  mediaIds: Map<string, number>,
): { input: ProductInput; warnings: string[] } {
  const warnings: string[] = [];
  const options = isDefaultOnly(product)
    ? []
    : [...product.options]
        .sort((a, b) => a.position - b.position)
        .map((o) => ({ name: o.name, values: o.optionValues.map((v) => v.name) }));

  const seenSkus = new Set<string>();
  const ordered = [...variants].sort((a, b) => a.position - b.position);
  const variantInputs = ordered.map((v) => {
    let sku = text(v.sku, 255);
    if (sku && seenSkus.has(sku.toLowerCase())) {
      warnings.push(`SKU "${sku}" repetido en "${v.title}": se importó sin SKU`);
      sku = null;
    }
    if (sku) seenSkus.add(sku.toLowerCase());

    const price = money(v.price) ?? '0';
    let compareAtPrice = money(v.compareAtPrice);
    // En el ERP el precio "antes" debe ser mayor que el precio (Shopify también lo ignora si no lo es).
    if (compareAtPrice && Number(compareAtPrice) <= Number(price)) compareAtPrice = null;

    const item = v.inventoryItem;
    const weight = item.measurement?.weight;
    const hs = item.harmonizedSystemCode?.trim();
    return {
      id: variantIds.get(v.id),
      optionValues: options.map((o) => v.selectedOptions.find((s) => s.name === o.name)?.value ?? ''),
      sku,
      barcode: text(v.barcodes.nodes[0]?.value, 255),
      price,
      compareAtPrice,
      cost: money(item.unitCost?.amount),
      tracked: item.tracked,
      inventoryPolicy: v.inventoryPolicy === 'CONTINUE' ? ('CONTINUE' as const) : ('DENY' as const),
      requiresShipping: item.requiresShipping,
      taxable: v.taxable,
      weight: weight && weight.value > 0 ? money(String(weight.value)) : null,
      weightUnit: (weight && WEIGHT_UNITS.includes(weight.unit) ? weight.unit : 'KILOGRAMS') as WeightUnit,
      countryCodeOfOrigin: item.countryCodeOfOrigin ?? null,
      harmonizedSystemCode: hs && /^\d{6,13}$/.test(hs) ? hs : null,
      quantities: [], // el stock se iguala aparte, por bodega (StockService.syncFromShopify)
    };
  });

  const handle = HANDLE.test(product.handle) ? product.handle : null;
  return {
    input: {
      title: product.title.trim().slice(0, 255),
      description: product.descriptionHtml.trim() || null,
      vendor: text(product.vendor, 255),
      productType: text(product.productType, 255),
      categoryId: product.category?.id ?? null,
      status: STATUS[product.status] ?? 'DRAFT',
      tags: product.tags.map((t) => t.trim()).filter(Boolean).slice(0, 250),
      options,
      media: product.media.nodes.flatMap((m) => {
        const id = mediaIds.get(m.id);
        return id ? [{ id, alt: text(m.alt, 512) }] : [];
      }),
      variants: variantInputs,
      seoTitle: text(product.seo.title, 70),
      seoDescription: text(product.seo.description, 160),
      handle,
    },
    warnings,
  };
}
