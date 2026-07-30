import { Fraunces, Inter } from 'next/font/google';
import type { TemplateProps } from '../registry';
import { CoffeeMakerV1 } from './CoffeeMakerV1';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });
const ruta = '/templates/coffee-maker';

const recursos = {
  __template_hero_mobile: `${ruta}/hero-mobile.webp`,
  __template_hero_desktop: `${ruta}/hero-desktop.webp`,
  __template_gallery_1: `${ruta}/gallery-1.webp`,
  __template_gallery_2: `${ruta}/gallery-2.webp`,
  __template_gallery_3: `${ruta}/grinder.webp`,
  __template_gallery_4: `${ruta}/gallery-4.jpg`,
  __template_recipe_1: `${ruta}/tinto.png`,
  __template_recipe_2: `${ruta}/cappuccino.jpg`,
  __template_recipe_3: `${ruta}/affogato.png`,
  __template_recipe_4: `${ruta}/coldbrew.png`,
  __template_bundle_1: `${ruta}/grinder.webp`,
  __template_bundle_2: `${ruta}/hero-desktop.webp`,
} as const;

/**
 * Restaura la dirección visual y los recursos de la plantilla original. Los
 * assets cargados por el tenant siempre reemplazan estos fallbacks.
 */
export function CoffeeMakerV12({ site, isPreview }: TemplateProps) {
  const sitioCompleto = {
    ...site,
    content: completarImagenes(site.content),
    assets: { ...recursos, ...site.assets },
  };

  return (
    <div className={`${inter.variable} ${fraunces.variable} bg-coffee-50 font-sans text-coffee-900`}>
      <Navegacion />
      <CoffeeMakerV1 site={sitioCompleto} isPreview={isPreview} referenceOrder />
      <Pie />
    </div>
  );
}

function completarImagenes(content: Record<string, unknown>): Record<string, unknown> {
  const hero = objeto(content.hero);
  const gallery = objeto(content.gallery);
  const recipes = objeto(content.recipes);
  const bundle = objeto(content.bundle);
  const hotspots = objeto(content.hotspots);

  return {
    ...content,
    hero: {
      ...hero,
      image_mobile: hero.image_mobile ?? '__template_hero_mobile',
      image_desktop: hero.image_desktop ?? '__template_hero_desktop',
    },
    hotspots: {
      ...hotspots,
      image: hotspots.image ?? hero.image_desktop ?? '__template_hero_desktop',
    },
    gallery: { ...gallery, items: completarLista(gallery.items, ['__template_gallery_1', '__template_gallery_2', '__template_gallery_3', '__template_gallery_4']) },
    recipes: { ...recipes, items: completarLista(recipes.items, ['__template_recipe_1', '__template_recipe_2', '__template_recipe_3', '__template_recipe_4']) },
    bundle: { ...bundle, items: completarLista(bundle.items, ['__template_bundle_1', '__template_bundle_2']) },
  };
}

function completarLista(value: unknown, fallbacks: readonly string[]): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = objeto(item);
    return { ...record, image: record.image ?? fallbacks[index] };
  });
}

function objeto(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function Navegacion() {
  return (
    <header className="sticky top-0 z-40 border-b border-coffee-100/80 bg-coffee-50/95 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <a href="#" className="font-serif text-xl font-bold tracking-tight">Coffee Maker <span className="text-gold-600">Pro</span></a>
        <div className="hidden items-center gap-7 text-sm font-semibold text-coffee-600 md:flex">
          <a className="transition hover:text-gold-600" href="#experiencia">Experiencia</a>
          <a className="transition hover:text-gold-600" href="#recetas">Resultados</a>
          <a className="transition hover:text-gold-600" href="#kit">Kit regalo</a>
          <a className="transition hover:text-gold-600" href="#ahorro">Ahorro</a>
        </div>
        <a href="#oferta" className="rounded-full bg-coffee-900 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-black">Pedir ahora</a>
      </nav>
    </header>
  );
}

function Pie() {
  return (
    <footer className="bg-coffee-950 px-6 py-14 text-coffee-200">
      <div className="mx-auto grid max-w-7xl gap-10 border-b border-white/10 pb-10 md:grid-cols-3">
        <div>
          <p className="font-serif text-2xl font-bold text-white">Coffee Maker <span className="text-gold-400">Pro</span></p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-coffee-300">Café de especialidad en casa, con molienda fresca y extracción profesional.</p>
        </div>
        <div>
          <p className="font-bold text-white">Explora</p>
          <div className="mt-4 flex flex-col gap-2 text-sm"><a href="#experiencia">Experiencia</a><a href="#recetas">Recetas</a><a href="#kit">Kit incluido</a></div>
        </div>
        <div>
          <p className="font-bold text-white">Compra con confianza</p>
          <p className="mt-4 text-sm leading-7">Envío gratis · Pago contraentrega<br />Garantía de 12 meses</p>
        </div>
      </div>
      <p className="mx-auto max-w-7xl pt-6 text-xs text-coffee-400">Coffee Maker Pro. Todos los derechos reservados.</p>
    </footer>
  );
}
