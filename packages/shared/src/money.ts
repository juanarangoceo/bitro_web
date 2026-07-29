/**
 * Dinero.
 *
 * Todo monto se guarda como entero en la unidad mínima de la moneda (centavos para
 * USD, pesos para COP). Nunca usamos `float` para dinero: el total de un pedido es
 * un dato contable y `0.1 + 0.2 !== 0.3` no es aceptable en una factura.
 */

/** Monedas soportadas en el piloto. */
export const SUPPORTED_CURRENCIES = ['COP', 'USD'] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Dígitos decimales por moneda.
 *
 * COP se opera sin decimales en comercio minorista colombiano: el monto entero ES
 * el peso.
 */
const CURRENCY_DECIMALS: Record<Currency, number> = {
  COP: 0,
  USD: 2,
};

export function isSupportedCurrency(value: string): value is Currency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

/** Línea de pedido tal como se calcula en el servidor. */
export interface OrderLineInput {
  /** Precio unitario en unidad mínima de la moneda. */
  unitAmount: number;
  quantity: number;
}

/** Desglose del total de un pedido. Todos los campos en unidad mínima. */
export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
}

/**
 * Calcula el total de un pedido a partir de la oferta publicada.
 *
 * Esta función es la única fuente de verdad del total (§14.2): el cliente jamás
 * envía un precio. Los montos llegan desde el snapshot de la oferta publicada.
 *
 * @throws Si algún monto no es un entero finito o si una cantidad no es positiva.
 */
export function calculateOrderTotals(params: {
  lines: readonly OrderLineInput[];
  discount?: number;
  shipping?: number;
}): OrderTotals {
  const { lines, discount = 0, shipping = 0 } = params;

  if (lines.length === 0) {
    throw new Error('Un pedido requiere al menos una línea');
  }

  let subtotal = 0;
  for (const line of lines) {
    assertIntegerAmount(line.unitAmount, 'unitAmount');
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) {
      throw new Error(`Cantidad inválida: ${line.quantity}`);
    }
    subtotal += line.unitAmount * line.quantity;
  }

  assertIntegerAmount(discount, 'discount');
  assertIntegerAmount(shipping, 'shipping');

  if (discount > subtotal) {
    throw new Error('El descuento no puede superar el subtotal');
  }

  const total = subtotal - discount + shipping;
  if (total < 0) {
    throw new Error('El total de un pedido no puede ser negativo');
  }

  return { subtotal, discount, shipping, total };
}

function assertIntegerAmount(value: number, field: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${field} debe ser un entero seguro, recibido: ${value}`);
  }
  if (value < 0) {
    throw new Error(`${field} no puede ser negativo, recibido: ${value}`);
  }
}

/**
 * Formatea un monto para mostrarlo al usuario.
 *
 * El locale por defecto es `es-CO` porque el piloto es Colombia; el renderer puede
 * pasar otro cuando la landing declare mercado distinto.
 */
export function formatMoney(
  amount: number,
  currency: Currency = 'COP',
  locale = 'es-CO',
): string {
  const decimals = CURRENCY_DECIMALS[currency];
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/** Porcentaje de ahorro entre el precio anterior y el actual, redondeado. */
export function savingsPercent(previousAmount: number, currentAmount: number): number | null {
  if (!Number.isFinite(previousAmount) || !Number.isFinite(currentAmount)) return null;
  if (previousAmount <= 0 || currentAmount < 0) return null;
  if (currentAmount >= previousAmount) return null;
  return Math.round(((previousAmount - currentAmount) / previousAmount) * 100);
}
