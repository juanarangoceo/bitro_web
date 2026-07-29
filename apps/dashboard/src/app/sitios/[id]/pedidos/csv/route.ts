/**
 * Exportación de pedidos a CSV (§10.5).
 *
 * Va por RLS con la sesión del usuario, así que no hace falta comprobar el
 * tenant a mano: un `site_id` de otro cliente devuelve cero filas.
 */

import { requerirSesion } from '@/lib/session';
import { supabaseServidor } from '@/lib/supabase';

const COLUMNAS = [
  'order_number',
  'created_at',
  'status',
  'customer_name',
  'customer_phone',
  'customer_email',
  'city',
  'address',
  'delivery_notes',
  'subtotal_amount',
  'discount_amount',
  'shipping_amount',
  'total_amount',
  'currency',
  'payment_method',
] as const;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requerirSesion();

  const { id } = await context.params;
  const supabase = await supabaseServidor();

  const { data: pedidos } = await supabase
    .from('orders')
    .select(COLUMNAS.join(', '))
    .eq('site_id', id)
    .order('created_at', { ascending: false });

  const filas = (pedidos ?? []) as unknown as Record<string, unknown>[];
  const lineas = [COLUMNAS.join(','), ...filas.map((p) => COLUMNAS.map((c) => celda(p[c])).join(','))];

  // BOM para que Excel en Windows reconozca UTF-8; sin él, los acentos de las
  // direcciones colombianas se muestran corruptos y el archivo parece roto.
  const cuerpo = `﻿${lineas.join('\r\n')}\r\n`;

  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pedidos-${id}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * Escapa un valor para CSV.
 *
 * El prefijo con comilla simple ante `= + - @` es deliberado: una dirección que
 * empiece por esos caracteres se interpretaría como fórmula al abrir el archivo
 * en Excel, y eso es una vía de ejecución con datos que escribe un comprador
 * anónimo desde el formulario público.
 */
function celda(valor: unknown): string {
  if (valor === null || valor === undefined) return '';

  let texto = String(valor);
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;

  return `"${texto.replace(/"/g, '""')}"`;
}
