// Contratos (esquemas y tipos) del dominio sync: importación y sincronización con Shopify.

/** Aviso de la importación: un producto que no se pudo importar o un dato que se omitió. */
export type ShopifyImportWarning = { product: string | null; message: string };

/** Máximo de avisos que se devuelven (el resto se cuenta en `failed`). */
export const MAX_IMPORT_WARNINGS = 50;

/** Resultado de "Importar desde Shopify" (ubicaciones, productos y stock). */
export type ShopifyImportResponse = {
  locations: { total: number; created: number; linked: number };
  products: { total: number; created: number; updated: number; unchanged: number; failed: number };
  /** Niveles de stock (variante + bodega) que cambiaron para igualar a Shopify. */
  stock: { adjusted: number };
  warnings: ShopifyImportWarning[];
};
