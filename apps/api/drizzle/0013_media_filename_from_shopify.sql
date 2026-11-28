-- Imágenes importadas de Shopify antes de existir media.filename: toman el nombre del archivo en su URL del CDN
-- (".../files/Main_b13a.jpg?v=1" -> "Main_b13a.jpg"), como lo muestra Shopify.
UPDATE "media" m
SET "filename" = left(regexp_replace(split_part(l."remote_url", '?', 1), '^.*/', ''), 255)
FROM "shopify_resource_links" l
WHERE l."resource_type" = 'MEDIA'
  AND l."erp_id" = m."id"
  AND l."tenant_id" = m."tenant_id"
  AND m."filename" IS NULL
  AND l."remote_url" IS NOT NULL
  AND regexp_replace(split_part(l."remote_url", '?', 1), '^.*/', '') <> '';
