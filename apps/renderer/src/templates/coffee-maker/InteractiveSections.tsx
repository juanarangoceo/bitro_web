'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

type Punto = { title: string; description: string; x: number; y: number };
type Receta = {
  title: string;
  subtitle?: string;
  time?: string;
  ingredients: string;
  steps: string;
  proSecret?: string;
  image?: string;
};

export function HotspotsInteractivos({
  image,
  title,
  points,
}: {
  image: string;
  title: string;
  points: Punto[];
}) {
  const [activo, setActivo] = useState<number | null>(null);
  const punto = activo === null ? null : points[activo];

  return (
    <div className="relative mx-auto aspect-square w-full max-w-4xl overflow-hidden rounded-[2rem] border-4 border-white bg-coffee-100 shadow-2xl">
      <Image src={image} alt={title} fill sizes="(max-width: 768px) 100vw, 80vw" className="object-contain" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" aria-hidden="true" />
      {points.map((item, index) => (
        <button
          key={`${item.title}-${index}`}
          type="button"
          className="absolute z-10 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-gold-500 text-xl font-bold text-white shadow-lg transition hover:scale-110 focus-visible:outline focus-visible:outline-4 focus-visible:outline-coffee-900"
          style={{ left: `${item.x}%`, top: `${item.y}%` }}
          onClick={() => setActivo((actual) => (actual === index ? null : index))}
          aria-expanded={activo === index}
          aria-label={`Ver detalle: ${item.title}`}
        >
          +
        </button>
      ))}
      {punto ? (
        <div className="absolute inset-x-4 bottom-4 z-20 rounded-2xl bg-white/95 p-5 shadow-2xl backdrop-blur md:left-auto md:max-w-sm">
          <button
            type="button"
            onClick={() => setActivo(null)}
            className="float-right rounded-full p-1 text-coffee-500 hover:bg-coffee-100"
            aria-label="Cerrar detalle"
          >
            ×
          </button>
          <h3 className="pr-8 font-serif text-xl font-bold">{punto.title}</h3>
          <p className="mt-2 leading-relaxed text-coffee-600">{punto.description}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Vídeo con carátula propia.
 *
 * Un `<video controls>` a secas pinta un rectángulo negro hasta que el
 * navegador descarga el primer fotograma, y en medio de una sección clara eso
 * se lee como un hueco roto. Aquí no se descarga nada hasta que alguien pulsa:
 * en móvil, que es de donde llega el tráfico de campañas, evita además varios
 * megabytes de vídeo que la mayoría no va a ver.
 */
export function ReproductorVideo({ src, label }: { src: string; label?: string }) {
  const [activo, setActivo] = useState(false);

  if (activo) {
    return (
      <video
        className="aspect-[9/16] w-full rounded-[2rem] bg-coffee-950 shadow-2xl md:aspect-video"
        controls
        autoPlay
        playsInline
        preload="metadata"
      >
        <source src={src} type="video/mp4" />
      </video>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActivo(true)}
      aria-label={label ? `Reproducir: ${label}` : 'Reproducir el vídeo'}
      className="group relative grid aspect-[9/16] w-full place-items-center overflow-hidden rounded-[2rem] bg-gradient-to-br from-coffee-800 to-coffee-950 shadow-2xl md:aspect-video"
    >
      <span className="grid h-20 w-20 place-items-center rounded-full bg-white/95 shadow-xl transition group-hover:scale-110">
        <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-8 w-8 text-coffee-900" aria-hidden="true">
          <path d="M8 5.14v13.72a1 1 0 0 0 1.52.85l11.14-6.86a1 1 0 0 0 0-1.7L9.52 4.29A1 1 0 0 0 8 5.14Z" />
        </svg>
      </span>
    </button>
  );
}

export function RecetasInteractivas({ recipes }: { recipes: Receta[] }) {
  const [activa, setActiva] = useState<number | null>(null);
  const receta = activa === null ? null : recipes[activa];

  useEffect(() => {
    if (activa === null) return;
    const cerrar = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiva(null);
    };
    window.addEventListener('keydown', cerrar);
    return () => window.removeEventListener('keydown', cerrar);
  }, [activa]);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {recipes.map((item, index) => (
          <button
            key={`${item.title}-${index}`}
            type="button"
            onClick={() => setActiva(index)}
            className="group overflow-hidden rounded-3xl border border-coffee-100 bg-white text-left shadow-md transition hover:-translate-y-2 hover:shadow-2xl"
          >
            <div className="relative h-52 bg-coffee-100">
              {item.image ? (
                <Image src={item.image} alt="" fill sizes="(max-width: 768px) 100vw, 25vw" className="object-cover transition duration-700 group-hover:scale-110" />
              ) : (
                <span className="grid h-full place-items-center text-5xl" aria-hidden="true">☕</span>
              )}
            </div>
            <span className="block p-6">
              <span className="block text-xl font-bold">{item.title}</span>
              {item.subtitle ? <span className="mt-1 block text-sm text-coffee-500">{item.subtitle}</span> : null}
              <span className="mt-4 block text-sm font-bold text-gold-600">Ver receta →</span>
            </span>
          </button>
        ))}
      </div>

      {receta ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receta-titulo"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiva(null);
          }}
        >
          <article className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl md:p-10">
            <button type="button" onClick={() => setActiva(null)} className="float-right rounded-full p-2 text-2xl hover:bg-coffee-100" aria-label="Cerrar receta">×</button>
            <p className="text-sm font-bold uppercase tracking-widest text-gold-600">{receta.time}</p>
            <h3 id="receta-titulo" className="mt-2 pr-12 font-serif text-3xl font-bold">{receta.title}</h3>
            <div className="mt-8 grid gap-8 md:grid-cols-2">
              <div><h4 className="font-bold">Ingredientes</h4><ListaLineas value={receta.ingredients} /></div>
              <div><h4 className="font-bold">Preparación</h4><ListaLineas value={receta.steps} ordered /></div>
            </div>
            {receta.proSecret ? <p className="mt-8 rounded-2xl bg-coffee-900 p-5 text-sm text-white"><strong>Secreto pro:</strong> {receta.proSecret}</p> : null}
          </article>
        </div>
      ) : null}
    </>
  );
}

function ListaLineas({ value, ordered = false }: { value: string; ordered?: boolean }) {
  const items = value.split('\n').map((v) => v.trim()).filter(Boolean);
  const Tag = ordered ? 'ol' : 'ul';
  return <Tag className={`mt-3 space-y-2 text-coffee-600 ${ordered ? 'list-decimal' : 'list-disc'} pl-5`}>{items.map((item, i) => <li key={`${item}-${i}`}>{item}</li>)}</Tag>;
}

export function ContadorOferta({ endsAt, label }: { endsAt: string; label: string }) {
  const objetivo = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const [ahora, setAhora] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(objetivo) || objetivo <= Date.now()) return;
    const timer = window.setInterval(() => setAhora(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [objetivo]);

  const restante = objetivo - ahora;
  if (!Number.isFinite(objetivo) || restante <= 0) return null;
  const horas = Math.floor(restante / 3_600_000);
  const minutos = Math.floor((restante % 3_600_000) / 60_000);
  const segundos = Math.floor((restante % 60_000) / 1_000);

  return (
    <div className="mb-6 flex flex-col items-center justify-between gap-3 rounded-xl bg-coffee-900 px-4 py-3 text-white sm:flex-row" aria-live="polite">
      <span className="text-xs font-bold uppercase tracking-widest text-gold-100">{label}</span>
      <span className="font-mono text-xl font-bold text-gold-400">
        {String(horas).padStart(2, '0')}:{String(minutos).padStart(2, '0')}:{String(segundos).padStart(2, '0')}
      </span>
    </div>
  );
}
