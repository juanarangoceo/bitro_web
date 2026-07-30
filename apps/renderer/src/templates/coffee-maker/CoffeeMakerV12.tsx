import { Fraunces, Inter, JetBrains_Mono } from 'next/font/google';
import type { TemplateProps } from '../registry';
import { list, section, text } from '../content';
import { CoffeeMakerV1 } from './CoffeeMakerV1';
import { Navegacion, type EnlaceNav } from './BrandChrome';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const fraunces = Fraunces({ subsets: ['latin'], variable: '--font-serif', display: 'swap' });
// El bloque de ahorro imita una factura impresa; con la monoespaciada del
// navegador las columnas de importes no alinean y el efecto se pierde.
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
const ruta = '/templates/coffee-maker';

const recursos = {
  __template_hero_mobile: `template:${ruta}/hero-mobile.webp`,
  __template_hero_desktop: `template:${ruta}/hero-desktop.webp`,
  __template_gallery_1: `template:${ruta}/gallery-1.webp`,
  __template_gallery_2: `template:${ruta}/gallery-2.webp`,
  __template_gallery_3: `template:${ruta}/grinder.webp`,
  __template_gallery_4: `template:${ruta}/gallery-4.jpg`,
  __template_recipe_1: `template:${ruta}/tinto.png`,
  __template_recipe_2: `template:${ruta}/cappuccino.jpg`,
  __template_recipe_3: `template:${ruta}/affogato.png`,
  __template_recipe_4: `template:${ruta}/coldbrew.png`,
  // Solo el primer regalo tiene fotografía propia. El segundo es un libro
  // digital: repetir ahí la foto de la máquina —que es lo que hacía el fallback
  // anterior— hace parecer que el kit trae dos cafeteras.
  __template_bundle_1: `template:${ruta}/grinder.webp`,
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

  const brand = section(site.content, 'brand');
  const nombre = text(brand, 'name') ?? site.siteName;

  return (
    <div
      className={`${inter.variable} ${fraunces.variable} ${mono.variable} bg-coffee-50 font-sans text-coffee-900`}
    >
      <Navegacion
        name={nombre}
        nameAccent={text(brand, 'name_accent')}
        tagline={text(brand, 'tagline')}
        links={enlaces(brand, 'nav_links')}
        ctaLabel={text(brand, 'cta_label') ?? 'Pedir ahora'}
      />
      <CoffeeMakerV1 site={sitioCompleto} isPreview={isPreview} referenceOrder />
      <Pie content={site.content} nombre={nombre} acento={text(brand, 'name_accent')} />
    </div>
  );
}

/** Enlaces de navegación válidos: sin etiqueta o sin ancla no llevan a ninguna parte. */
function enlaces(source: Record<string, unknown>, key: string): EnlaceNav[] {
  return list(source, key).flatMap((item) => {
    const label = text(item, 'label');
    const anchor = text(item, 'anchor');
    return label && anchor ? [{ label, anchor }] : [];
  });
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
    bundle: { ...bundle, items: completarLista(bundle.items, ['__template_bundle_1']) },
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

/**
 * Pie de página.
 *
 * La columna legal es la razón de que exista como contenido y no como texto
 * fijo: Meta y Google exigen que la política de datos sea alcanzable desde la
 * landing, y esa política es del cliente, no de la plantilla. Si no tiene
 * enlaces cargados, la columna no se dibuja — mejor ausente que apuntando a una
 * página que no existe.
 */
function Pie({
  content,
  nombre,
  acento,
}: {
  content: Record<string, unknown>;
  nombre: string;
  acento?: string;
}) {
  const pie = section(content, 'footer');
  const explorar = enlaces(pie, 'explore_links');
  const legales = list(pie, 'legal_links').flatMap((item) => {
    const label = text(item, 'label');
    const url = text(item, 'url');
    return label && url ? [{ label, url }] : [];
  });
  const contacto = list(pie, 'contact_lines').flatMap((item) => text(item, 'text') ?? []);

  return (
    <footer className="bg-coffee-950 px-6 py-14 text-coffee-200">
      <div className="mx-auto grid max-w-7xl gap-10 border-b border-white/10 pb-10 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-serif text-2xl font-bold text-white">
            {nombre}
            {acento ? <span className="text-gold-400">{acento}</span> : null}
          </p>
          {text(pie, 'about') && (
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-coffee-300">
              {text(pie, 'about')}
            </p>
          )}
        </div>

        {explorar.length > 0 && (
          <div>
            <p className="font-bold text-white">{text(pie, 'explore_label') ?? 'Explora'}</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {explorar.map((link) => (
                <a key={link.anchor} className="hover:text-gold-400" href={`#${link.anchor}`}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {legales.length > 0 && (
          <div>
            <p className="font-bold text-white">{text(pie, 'legal_label') ?? 'Legal'}</p>
            <div className="mt-4 flex flex-col gap-2 text-sm">
              {legales.map((link) => (
                <a
                  key={link.url}
                  className="hover:text-gold-400"
                  href={link.url}
                  rel="noreferrer nofollow"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}

        {contacto.length > 0 && (
          <div>
            <p className="font-bold text-white">
              {text(pie, 'contact_label') ?? 'Compra con confianza'}
            </p>
            <div className="mt-4 space-y-1 text-sm leading-6">
              {contacto.map((linea) => (
                <p key={linea}>{linea}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="mx-auto max-w-7xl pt-6 text-xs text-coffee-400">
        © {new Date().getFullYear()} {nombre}
        {acento ?? ''}. {text(pie, 'copyright') ?? 'Todos los derechos reservados.'}
      </p>
    </footer>
  );
}
