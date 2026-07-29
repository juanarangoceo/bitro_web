import { describe, expect, it } from 'vitest';
import { normalizeHostname, subdomainSlug, validateSubdomainSlug } from '../hostname';

describe('normalizeHostname', () => {
  it('normaliza mayúsculas y espacios', () => {
    expect(normalizeHostname('  CafeteraExpress.COM ')).toBe('cafeteraexpress.com');
  });

  it('remueve esquema, puerto, path y query', () => {
    expect(normalizeHostname('https://cafetera.nitrolanding.co:443/oferta?utm_source=meta')).toBe(
      'cafetera.nitrolanding.co',
    );
  });

  it('remueve credenciales embebidas en la URL', () => {
    expect(normalizeHostname('http://user:pass@ejemplo.com/x')).toBe('ejemplo.com');
  });

  it('remueve el punto final del FQDN absoluto', () => {
    expect(normalizeHostname('ejemplo.com.')).toBe('ejemplo.com');
  });

  it('conserva www como hostname distinto', () => {
    // `www.x.com` y `x.com` son filas separadas en `domains`; una redirige a la otra.
    expect(normalizeHostname('www.ejemplo.com')).toBe('www.ejemplo.com');
  });

  it('rechaza hostnames de una sola etiqueta', () => {
    expect(normalizeHostname('localhost')).toBeNull();
    expect(normalizeHostname('com')).toBeNull();
  });

  it('rechaza IPv6 y entradas vacías', () => {
    expect(normalizeHostname('[::1]')).toBeNull();
    expect(normalizeHostname('')).toBeNull();
    expect(normalizeHostname(null)).toBeNull();
    expect(normalizeHostname(undefined)).toBeNull();
  });

  it('rechaza etiquetas con guiones en los extremos o caracteres inválidos', () => {
    expect(normalizeHostname('-malo.com')).toBeNull();
    expect(normalizeHostname('malo-.com')).toBeNull();
    expect(normalizeHostname('ma_lo.com')).toBeNull();
  });

  it('rechaza hostnames que exceden el límite de RFC 1035', () => {
    const largo = `${'a'.repeat(60)}.`.repeat(5) + 'com';
    expect(normalizeHostname(largo)).toBeNull();
  });
});

describe('subdomainSlug', () => {
  const root = 'nitrolanding.co';

  it('extrae el slug de un subdominio del dominio operativo', () => {
    expect(subdomainSlug('cafetera.nitrolanding.co', root)).toBe('cafetera');
  });

  it('devuelve null para un dominio propio', () => {
    expect(subdomainSlug('cafeteraexpress.com', root)).toBeNull();
  });

  it('devuelve null para el dominio raíz mismo', () => {
    expect(subdomainSlug('nitrolanding.co', root)).toBeNull();
  });

  it('rechaza subdominios anidados', () => {
    // `a.b.root` no corresponde a un slug de cliente: solo un nivel es válido.
    expect(subdomainSlug('a.b.nitrolanding.co', root)).toBeNull();
  });

  it('no confunde un dominio que solo termina parecido', () => {
    expect(subdomainSlug('falsonitrolanding.co', root)).toBeNull();
  });
});

describe('validateSubdomainSlug', () => {
  it('acepta un slug válido y lo normaliza', () => {
    expect(validateSubdomainSlug('  Cafetera-Pro ')).toEqual({ ok: true, slug: 'cafetera-pro' });
  });

  it('rechaza slugs reservados de infraestructura y de marca', () => {
    expect(validateSubdomainSlug('www')).toEqual({ ok: false, reason: 'reserved' });
    expect(validateSubdomainSlug('admin')).toEqual({ ok: false, reason: 'reserved' });
    expect(validateSubdomainSlug('nitro')).toEqual({ ok: false, reason: 'reserved' });
  });

  it('rechaza vacío, caracteres inválidos y exceso de longitud', () => {
    expect(validateSubdomainSlug('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(validateSubdomainSlug('con espacio')).toEqual({ ok: false, reason: 'invalid_chars' });
    expect(validateSubdomainSlug('a'.repeat(64))).toEqual({ ok: false, reason: 'too_long' });
  });
});
