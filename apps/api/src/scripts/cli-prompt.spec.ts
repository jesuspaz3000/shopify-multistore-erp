import { cleanArg } from './cli-prompt.js';

describe('cleanArg', () => {
  it('revierte el escape ^ que npm agrega en Windows', () => {
    expect(cleanArg('^Distribuidora^ Ñuñoa^ Ltda^', 'win32')).toBe('Distribuidora Ñuñoa Ltda');
  });

  it('no toca valores sin escape ni en otros sistemas', () => {
    expect(cleanArg('Mi Empresa', 'win32')).toBe('Mi Empresa');
    expect(cleanArg('^raro^', 'linux')).toBe('^raro^');
    expect(cleanArg(undefined, 'win32')).toBeUndefined();
  });
});
