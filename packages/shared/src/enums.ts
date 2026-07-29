/**
 * Enumeraciones del dominio compartidas entre dashboard, renderer y base de datos.
 *
 * Estos valores existen también como tipos ENUM en Postgres. Cambiar un valor aquí
 * sin migrar la base rompe inserciones en runtime: mantener ambos lados sincronizados
 * y agregar valores solo al final.
 */

/** Estados del ciclo de vida de un pedido (§10.1). */
export const ORDER_STATUSES = [
  'new',
  'pending_confirmation',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Estados de un sitio (§4.5).
 *
 * `changes_pending` no es un estado almacenado: se deriva comparando el timestamp
 * del borrador con el de la última publicación. Se declara aquí porque la interfaz
 * lo trata como un estado más.
 */
export const SITE_STATUSES = [
  'draft',
  'published',
  'changes_pending',
  'paused',
  'archived',
] as const;

export type SiteStatus = (typeof SITE_STATUSES)[number];

/** Estados de un contacto / suscriptor (§10.4). */
export const CONTACT_STATUSES = [
  'new',
  'contacted',
  'converted',
  'discarded',
  'unsubscribed',
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/**
 * Formas de pago admitidas en el piloto (§10.2).
 *
 * `cod` (contraentrega) es la dominante en el mercado objetivo. `online` queda
 * declarado pero sin pasarela: el piloto no procesa pagos del comprador.
 */
export const PAYMENT_METHODS = ['cod', 'transfer', 'online'] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
