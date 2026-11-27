import sanitizeHtml from 'sanitize-html';

/**
 * La descripción llega como HTML del editor. Antes de guardarla se deja SOLO el formato que el editor
 * produce (párrafos, títulos, negrita, listas, enlaces...): sin <script>, estilos, eventos (onclick)
 * ni enlaces "javascript:". Así el HTML se puede mostrar luego sin riesgo de XSS.
 */
export function sanitizeDescription(html: string | null): string | null {
  if (!html) return null;
  const clean = sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'a', 'code', 'pre', 'hr'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    // Los enlaces externos se abren aparte y sin acceso a la página de origen.
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  }).trim();
  // Un editor vacío deja "<p></p>": no es una descripción.
  return clean.replace(/<p>\s*<\/p>/g, '').trim() ? clean : null;
}
