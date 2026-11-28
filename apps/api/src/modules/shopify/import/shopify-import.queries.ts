// Consultas del Admin API (2026-10) para importar. Cada una por debajo del costo máximo (1000 puntos).

export const LOCATIONS_QUERY = /* GraphQL */ `
  query ImportLocations($after: String) {
    locations(first: 50, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        legacyResourceId
        name
        isActive
        fulfillsOnlineOrders
        hasActiveInventory
        address { address1 address2 city province provinceCode countryCode zip phone }
      }
    }
  }
`;

/** Stock disponible de todos los ítems de una ubicación (paginado). */
export const LOCATION_LEVELS_QUERY = /* GraphQL */ `
  query ImportLevels($id: ID!, $after: String) {
    location(id: $id) {
      inventoryLevels(first: 250, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          item { id }
          quantities(names: ["available"]) { name quantity }
        }
      }
    }
  }
`;

/** Lista liviana: decide qué productos cambiaron desde la última importación. */
export const PRODUCT_IDS_QUERY = /* GraphQL */ `
  query ImportProductIds($after: String) {
    products(first: 100, after: $after, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes { id title updatedAt category { id } }
    }
  }
`;

/** Un producto completo; las variantes se paginan (hasta 2048 por producto). */
export const PRODUCT_QUERY = /* GraphQL */ `
  query ImportProduct($id: ID!, $after: String) {
    product(id: $id) {
      id
      handle
      title
      descriptionHtml
      vendor
      productType
      category { id }
      status
      tags
      updatedAt
      seo { title description }
      options { name position optionValues { name hasVariants } }
      media(first: 50) {
        nodes {
          id
          alt
          mediaContentType
          ... on MediaImage { image { url width height } }
        }
      }
      variants(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          title
          sku
          price
          compareAtPrice
          inventoryPolicy
          taxable
          position
          barcodes(first: 1) { nodes { value } }
          selectedOptions { name value }
          inventoryItem {
            id
            tracked
            requiresShipping
            unitCost { amount }
            countryCodeOfOrigin
            harmonizedSystemCode
            measurement { weight { value unit } }
          }
        }
      }
    }
  }
`;

export type PageInfo = { hasNextPage: boolean; endCursor: string | null };

export type ShopifyLocationNode = {
  id: string;
  legacyResourceId: string;
  name: string;
  isActive: boolean;
  fulfillsOnlineOrders: boolean;
  hasActiveInventory: boolean;
  address: {
    address1: string | null;
    address2: string | null;
    city: string | null;
    province: string | null;
    provinceCode: string | null;
    countryCode: string | null;
    zip: string | null;
    phone: string | null;
  };
};
