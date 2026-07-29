import { describe, expect, it } from 'vitest';
import { normalizeEmail, normalizePhone, slugify } from '../normalize';

describe('normalizeEmail', () => {
  it('aplica trim y minúsculas', () => {
    expect(normalizeEmail('  Juan@Ejemplo.COM ')).toBe('juan@ejemplo.com');
  });

  it('conserva el sufijo +tag como dirección distinta', () => {
    // Colapsar `+tag` uniría compradores distintos bajo un mismo contacto.
    expect(normalizeEmail('juan+pedidos@ejemplo.com')).toBe('juan+pedidos@ejemplo.com');
  });

  it('rechaza direcciones estructuralmente inválidas', () => {
    expect(normalizeEmail('sin-arroba')).toBeNull();
    expect(normalizeEmail('doble@@ejemplo.com')).toBeNull();
    expect(normalizeEmail('sin@dominio')).toBeNull();
    expect(normalizeEmail('')).toBeNull();
  });
});

describe('normalizePhone', () => {
  it('agrega el indicativo colombiano a un número nacional de 10 dígitos', () => {
    expect(normalizePhone('314 668 1896')).toBe('573146681896');
  });

  it('respeta un prefijo internacional explícito', () => {
    expect(normalizePhone('+57 314 6681896')).toBe('573146681896');
    expect(normalizePhone('0057 3146681896')).toBe('573146681896');
  });

  it('remueve el cero de larga distancia nacional', () => {
    expect(normalizePhone('03146681896')).toBe('573146681896');
  });

  it('no reetiqueta como colombiano un número extranjero con prefijo', () => {
    expect(normalizePhone('+1 415 555 0132')).toBe('14155550132');
  });

  it('rechaza números fuera del rango E.164', () => {
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+1234567890123456')).toBeNull();
    expect(normalizePhone('sin dígitos')).toBeNull();
  });
});

describe('slugify', () => {
  it('remueve tildes y normaliza separadores', () => {
    expect(slugify('Cafetera Espresso Profesional ¡Única!')).toBe(
      'cafetera-espresso-profesional-unica',
    );
  });

  it('no deja guiones colgantes al truncar', () => {
    expect(slugify('aaa bbb ccc', 8)).toBe('aaa-bbb');
  });
});
