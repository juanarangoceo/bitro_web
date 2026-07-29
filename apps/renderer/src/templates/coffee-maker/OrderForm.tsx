'use client';

import { useEffect, useState } from 'react';
import { UTM_KEYS, CLICK_ID_KEYS } from '@nitro-web/shared';

/**
 * Formulario de pedido.
 *
 * Lo que este componente **no** hace, a propósito:
 *
 *   - No envía precios ni totales. El servidor los calcula desde la oferta
 *     publicada (§14.2). Un campo de precio aquí, aunque fuera oculto, sería una
 *     invitación a manipularlo.
 *   - No escribe en la base. Llama a `/api/orders`, que valida y delega en
 *     `create_public_order()`.
 *
 * La atribución se lee del propio navegador al montar: los UTMs vienen en la URL
 * del anuncio y el `referrer` solo existe en el cliente.
 */

interface Props {
  siteId: string;
  ctaLabel: string;
  ctaSubtext?: string;
  isPreview?: boolean;
}

type Status = { kind: 'idle' | 'sending' } | { kind: 'ok'; orderNumber: string } | { kind: 'error'; message: string };

export function OrderForm({ siteId, ctaLabel, ctaSubtext, isPreview }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [attribution, setAttribution] = useState<Record<string, string>>({});
  const [idempotencyKey, setIdempotencyKey] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const captured: Record<string, string> = {};

    for (const key of [...UTM_KEYS, ...CLICK_ID_KEYS]) {
      const value = params.get(key);
      if (value) captured[key] = value.slice(0, 255);
    }
    if (document.referrer) captured.referrer = document.referrer.slice(0, 255);
    captured.landing_url = window.location.href.slice(0, 255);

    setAttribution(captured);

    // La clave se genera una vez por montaje del formulario. Un doble clic o un
    // reintento tras un fallo de red reenvían la misma clave, y el servidor
    // devuelve el pedido original en lugar de crear un duplicado (§14.2).
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status.kind === 'sending') return;

    const formData = new FormData(event.currentTarget);

    // Trampa anti-spam: un campo invisible que una persona nunca llena pero un
    // bot que rellena todo sí. Se corta en el cliente y también en el servidor.
    if (formData.get('website')) return;

    setStatus({ kind: 'sending' });

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          site_id: siteId,
          customer_name: formData.get('customer_name'),
          customer_phone: formData.get('customer_phone'),
          customer_email: formData.get('customer_email') || null,
          city: formData.get('city'),
          address: formData.get('address'),
          delivery_notes: formData.get('delivery_notes') || null,
          quantity: Number(formData.get('quantity') ?? 1),
          website: formData.get('website') || '',
          attribution,
          idempotency_key: idempotencyKey,
        }),
      });

      const payload = (await response.json()) as { order_number?: string; error?: string };

      if (!response.ok) {
        setStatus({
          kind: 'error',
          message: payload.error ?? 'No pudimos registrar tu pedido. Intenta de nuevo.',
        });
        return;
      }

      setStatus({ kind: 'ok', orderNumber: payload.order_number ?? '' });
    } catch {
      setStatus({
        kind: 'error',
        message: 'Hubo un problema de conexión. Revisa tu internet e intenta de nuevo.',
      });
    }
  }

  if (status.kind === 'ok') {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-bold text-green-800">¡Pedido recibido!</p>
        <p className="mt-2 text-sm text-green-700">
          Tu número de pedido es <strong>{status.orderNumber}</strong>. Te contactaremos por
          WhatsApp para confirmar la entrega.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field name="customer_name" label="Nombre completo" autoComplete="name" required />
      <Field
        name="customer_phone"
        label="WhatsApp"
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        required
      />
      <Field name="customer_email" label="Correo (opcional)" type="email" autoComplete="email" />
      <Field name="city" label="Ciudad" autoComplete="address-level2" required />
      <Field name="address" label="Dirección de entrega" autoComplete="street-address" required />

      <input type="hidden" name="quantity" value={1} />

      {/* Honeypot. `aria-hidden` y `tabIndex={-1}` lo sacan del flujo para
          quien usa lector de pantalla o teclado; solo lo ve un bot. */}
      <div className="absolute left-[-9999px]" aria-hidden="true">
        <label htmlFor="website">No llenar</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status.kind === 'error' && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={status.kind === 'sending' || isPreview}
        className="flex w-full flex-col items-center justify-center gap-1 rounded-xl bg-coffee-900 py-4 text-lg font-bold text-white shadow-xl transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60 md:text-xl"
      >
        <span>{status.kind === 'sending' ? 'Enviando…' : ctaLabel}</span>
        {ctaSubtext && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-coffee-200">
            {ctaSubtext}
          </span>
        )}
      </button>

      {isPreview && (
        <p className="text-center text-xs text-coffee-500">
          En vista previa el formulario está deshabilitado: no se crean pedidos de prueba.
        </p>
      )}
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required,
  autoComplete,
  inputMode,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: 'tel' | 'text' | 'email';
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-coffee-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="w-full rounded-lg border border-coffee-200 px-4 py-3 text-coffee-900 outline-none transition focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
      />
    </div>
  );
}
