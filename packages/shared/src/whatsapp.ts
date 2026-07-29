/**
 * Enlaces wa.me para confirmar pedidos.
 *
 * El piloto NO usa la API de WhatsApp ni Twilio (§10.3): el vendedor pulsa un botón
 * que abre WhatsApp con un mensaje prellenado. Esto evita costos por conversación y
 * el proceso de aprobación de Meta.
 */

import { normalizePhone } from './normalize';

/** Datos disponibles para interpolar en la plantilla del mensaje. */
export interface WhatsAppMessageContext {
  customerName: string;
  offerTitle: string;
  /** Total ya formateado para lectura humana, p. ej. "$490.000". */
  total: string;
  city: string;
  orderNumber: string;
}

/**
 * Plantilla por defecto del mensaje de confirmación.
 *
 * Cada tenant puede sobrescribirla; los marcadores son `{clave}` con las claves de
 * `WhatsAppMessageContext`.
 */
export const DEFAULT_WHATSAPP_TEMPLATE =
  'Hola {customerName}, te escribimos para confirmar tu pedido {orderNumber}: ' +
  '{offerTitle} por {total} con envío a {city}. ¿Confirmas los datos?';

/**
 * Construye la URL wa.me con el mensaje prellenado.
 *
 * @param phone Teléfono del comprador en cualquier formato; se normaliza a E.164.
 * @returns La URL, o `null` si el teléfono no es utilizable.
 */
export function buildWhatsAppUrl(params: {
  phone: string | null | undefined;
  context: WhatsAppMessageContext;
  template?: string;
}): string | null {
  const phone = normalizePhone(params.phone);
  if (!phone) return null;

  const template = params.template?.trim() || DEFAULT_WHATSAPP_TEMPLATE;
  const message = renderTemplate(template, params.context);

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Sustituye los marcadores `{clave}` por su valor.
 *
 * Un marcador desconocido se deja tal cual en lugar de vaciarse: así el vendedor ve
 * que su plantilla tiene un error en vez de enviar un mensaje con huecos.
 */
function renderTemplate(template: string, context: WhatsAppMessageContext): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = context[key as keyof WhatsAppMessageContext];
    return value === undefined || value === null ? match : String(value);
  });
}
