import { describe, expect, it } from 'vitest';
import { calculateOrderTotals, formatMoney, savingsPercent } from '../money';

describe('calculateOrderTotals', () => {
  it('suma líneas por cantidad', () => {
    const totals = calculateOrderTotals({
      lines: [
        { unitAmount: 490_000, quantity: 2 },
        { unitAmount: 47_000, quantity: 1 },
      ],
    });
    expect(totals).toEqual({
      subtotal: 1_027_000,
      discount: 0,
      shipping: 0,
      total: 1_027_000,
    });
  });

  it('aplica descuento y envío', () => {
    const totals = calculateOrderTotals({
      lines: [{ unitAmount: 490_000, quantity: 1 }],
      discount: 40_000,
      shipping: 15_000,
    });
    expect(totals.total).toBe(465_000);
  });

  it('rechaza un pedido sin líneas', () => {
    expect(() => calculateOrderTotals({ lines: [] })).toThrow(/al menos una línea/);
  });

  it('rechaza un descuento mayor al subtotal', () => {
    // Sin esta guarda, un total negativo entraría a la contabilidad del tenant.
    expect(() =>
      calculateOrderTotals({
        lines: [{ unitAmount: 100_000, quantity: 1 }],
        discount: 150_000,
      }),
    ).toThrow(/no puede superar el subtotal/);
  });

  it('rechaza montos no enteros', () => {
    expect(() => calculateOrderTotals({ lines: [{ unitAmount: 490_000.5, quantity: 1 }] })).toThrow(
      /entero seguro/,
    );
  });

  it('rechaza cantidades no positivas', () => {
    expect(() => calculateOrderTotals({ lines: [{ unitAmount: 490_000, quantity: 0 }] })).toThrow(
      /Cantidad inválida/,
    );
  });

  it('rechaza montos negativos', () => {
    expect(() =>
      calculateOrderTotals({ lines: [{ unitAmount: 490_000, quantity: 1 }], shipping: -1 }),
    ).toThrow(/no puede ser negativo/);
  });
});

describe('formatMoney', () => {
  it('formatea COP sin decimales', () => {
    // Intl usa espacios no separables; comparamos solo los dígitos relevantes.
    const formatted = formatMoney(490_000, 'COP');
    expect(formatted).toContain('490.000');
    expect(formatted).not.toContain(',00');
  });
});

describe('savingsPercent', () => {
  it('calcula el ahorro redondeado', () => {
    expect(savingsPercent(1_190_000, 490_000)).toBe(59);
  });

  it('devuelve null cuando no hay ahorro real', () => {
    expect(savingsPercent(490_000, 490_000)).toBeNull();
    expect(savingsPercent(490_000, 590_000)).toBeNull();
    expect(savingsPercent(0, 100)).toBeNull();
  });
});
