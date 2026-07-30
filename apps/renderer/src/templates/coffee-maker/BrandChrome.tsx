'use client';

import { useState } from 'react';

export type EnlaceNav = { label: string; anchor: string };

/**
 * Cabecera fija de la plantilla.
 *
 * El menú desplegable no es un adorno: sin él, en móvil la cabecera se queda
 * con el logotipo y un botón, y la landing pierde toda navegación justo en el
 * dispositivo del que llega la mayor parte del tráfico de campañas.
 */
export function Navegacion({
  name,
  nameAccent,
  tagline,
  links,
  ctaLabel,
}: {
  name: string;
  nameAccent?: string;
  tagline?: string;
  links: EnlaceNav[];
  ctaLabel: string;
}) {
  const [abierto, setAbierto] = useState(false);

  const marca = (
    <span className="flex items-center gap-2">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-coffee-900 text-lg text-gold-500 md:h-10 md:w-10">
        ☕
      </span>
      <span className="flex flex-col justify-center">
        <span className="font-serif text-xl font-black leading-none tracking-tight md:text-2xl">
          {name}
          {nameAccent ? <span className="text-gold-500">{nameAccent}</span> : null}
        </span>
        {tagline ? (
          <span className="hidden text-[9px] font-bold uppercase tracking-widest text-coffee-600 sm:block md:text-[10px]">
            {tagline}
          </span>
        ) : null}
      </span>
    </span>
  );

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-coffee-100/80 bg-coffee-50/95 backdrop-blur-xl">
        <nav className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-6 py-3">
          <a href="#" aria-label={name}>
            {marca}
          </a>

          <div className="hidden items-center gap-7 text-sm font-bold uppercase tracking-wide text-coffee-800 md:flex">
            {links.map((link) => (
              <a key={link.anchor} className="transition hover:text-gold-600" href={`#${link.anchor}`}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#oferta"
              className="rounded-full bg-gold-500 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-gold-500/20 transition hover:bg-gold-600 sm:text-sm"
            >
              {ctaLabel}
            </a>
            {links.length > 0 && (
              <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                aria-expanded={abierto}
                aria-label={abierto ? 'Cerrar el menú' : 'Abrir el menú'}
                className="rounded-lg border border-coffee-100 bg-white/90 p-2 text-coffee-900 shadow-sm md:hidden"
              >
                <span aria-hidden="true" className="block text-xl leading-none">
                  {abierto ? '×' : '☰'}
                </span>
              </button>
            )}
          </div>
        </nav>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-50 flex flex-col gap-8 overflow-y-auto bg-coffee-50/98 px-8 pt-8 backdrop-blur-xl md:hidden">
          <button
            type="button"
            onClick={() => setAbierto(false)}
            aria-label="Cerrar el menú"
            className="self-end rounded-lg border border-coffee-100 bg-white p-2 text-2xl leading-none text-coffee-900"
          >
            ×
          </button>
          {links.map((link) => (
            <a
              key={link.anchor}
              href={`#${link.anchor}`}
              onClick={() => setAbierto(false)}
              className="border-b-2 border-transparent pb-2 text-left font-serif text-3xl font-bold text-coffee-900 transition hover:border-gold-500"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#oferta"
            onClick={() => setAbierto(false)}
            className="mb-12 mt-auto rounded-xl bg-gold-500 py-4 text-center text-xl font-bold text-white shadow-xl"
          >
            {ctaLabel}
          </a>
        </div>
      )}
    </>
  );
}
