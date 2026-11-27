import { sanitizeDescription } from './sanitize-description.js';

describe('sanitizeDescription', () => {
  it('conserva el formato del editor', () => {
    const html = '<h2>Detalles</h2><p><strong>100%</strong> algodón, <em>suave</em> y <u>fresca</u>.</p><ul><li>Talla S</li></ul>';
    expect(sanitizeDescription(html)).toBe(html);
  });

  it('quita scripts, eventos, estilos e iframes', () => {
    const dirty = '<p onclick="robar()" style="color:red">Hola</p><script>alert(1)</script><iframe src="https://x.com"></iframe><img src=x onerror=alert(1)>';
    expect(sanitizeDescription(dirty)).toBe('<p>Hola</p>');
  });

  it('enlaces: solo http(s)/mailto y abren aparte sin acceso al origen', () => {
    expect(sanitizeDescription('<a href="javascript:alert(1)">x</a>')).toBe('<a target="_blank" rel="noopener noreferrer">x</a>');
    expect(sanitizeDescription('<a href="https://tienda.com">ver</a>')).toBe(
      '<a href="https://tienda.com" target="_blank" rel="noopener noreferrer">ver</a>',
    );
  });

  it('un editor vacío no es una descripción', () => {
    expect(sanitizeDescription('<p></p>')).toBeNull();
    expect(sanitizeDescription('')).toBeNull();
    expect(sanitizeDescription(null)).toBeNull();
  });
});
