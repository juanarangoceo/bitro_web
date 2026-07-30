import Image from 'next/image';
import { formatMoney, savingsPercent, type Currency } from '@nitro-web/shared';
import type { TemplateProps } from '../registry';
import { assetUrl, bool, list, num, section, text } from '../content';
import { OrderForm } from './OrderForm';
import { ContadorOferta, HotspotsInteractivos, RecetasInteractivas } from './InteractiveSections';

/**
 * Plantilla Coffee Maker v1.
 *
 * Estructura de conversión portada de la landing en producción: promesa →
 * problema → producto → kit → economía → prueba → oferta → objeciones.
 *
 * Todo el texto sale del `content_json`. El **precio no**: viene de
 * `offer_snapshot`, congelado al publicar, que es el mismo del que
 * `create_public_order()` calcula el total. Así lo que ve el comprador y lo que
 * cobra el servidor no pueden divergir.
 */
export function CoffeeMakerV1({
  site,
  isPreview,
  referenceOrder = false,
}: TemplateProps & { referenceOrder?: boolean }) {
  const { content, offer, assets } = site;

  const priceAmount = typeof offer.price_amount === 'number' ? offer.price_amount : undefined;
  const compareAtAmount =
    typeof offer.compare_at_amount === 'number' ? offer.compare_at_amount : undefined;
  const currency = (typeof offer.currency === 'string' ? offer.currency : 'COP') as Currency;

  return (
    <main className="min-h-screen bg-coffee-50 pb-24 text-coffee-900 md:pb-0">
      <Hero content={content} assets={assets} />
      <Problem content={content} />
      {referenceOrder ? (
        <>
          <Hotspots content={content} assets={assets} />
          <Gallery content={content} assets={assets} />
        </>
      ) : (
        <>
          <Gallery content={content} assets={assets} />
          <Hotspots content={content} assets={assets} />
        </>
      )}
      <Recipes content={content} assets={assets} />
      <Bundle content={content} assets={assets} />
      <Savings content={content} />
      <SocialProof content={content} assets={assets} />
      <Offer
        content={content}
        siteId={site.siteId}
        priceAmount={priceAmount}
        compareAtAmount={compareAtAmount}
        currency={currency}
        isPreview={isPreview}
      />
      <Faq content={content} />
      <StickyCta content={content} />
    </main>
  );
}

type ContentProps = { content: Record<string, unknown> };

/** Índice `assets.id` → ruta en Storage. Lo necesita todo bloque con imágenes. */
type AssetProps = { assets: Record<string, string> };

// ---------------------------------------------------------------------------

function Hero({ content, assets }: ContentProps & AssetProps) {
  const hero = section(content, 'hero');
  const headline = text(hero, 'headline');
  const mobile = assetUrl(hero.image_mobile, assets);
  const desktop = assetUrl(hero.image_desktop, assets);

  if (!headline) return null;

  return (
    <section className="relative overflow-hidden px-6 pb-16 pt-16 lg:pb-28 lg:pt-28">
      <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[500px] w-[500px] -translate-y-1/3 translate-x-1/3 rounded-full bg-gradient-to-br from-gold-100/40 to-transparent blur-3xl" />

      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <div className="order-2 space-y-6 text-center lg:order-1 lg:text-left">
          <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            {headline}
            {text(hero, 'headline_highlight') && (
              <>
                <br />
                <span className="bg-gradient-to-r from-gold-600 to-gold-400 bg-clip-text italic text-transparent">
                  {text(hero, 'headline_highlight')}
                </span>
              </>
            )}
          </h1>

          {text(hero, 'subheadline') && (
            <p className="mx-auto max-w-lg text-lg font-medium leading-relaxed text-coffee-600 lg:mx-0">
              {text(hero, 'subheadline')}
            </p>
          )}

          <a
            href="#oferta"
            className="inline-flex items-center gap-2 rounded-xl bg-coffee-900 px-8 py-4 text-lg font-bold text-white shadow-xl transition hover:bg-black"
          >
            {text(hero, 'cta_label') ?? 'Ver la oferta'}
          </a>

          {list(hero, 'badges').length > 0 && (
            <ul className="flex flex-wrap justify-center gap-x-6 gap-y-3 border-t border-coffee-200 pt-6 text-sm font-medium text-coffee-700 lg:justify-start">
              {list(hero, 'badges').map((badge, i) => (
                <li key={i} className="flex items-center gap-2">
                  <CheckIcon />
                  {text(badge, 'text')}
                </li>
              ))}
            </ul>
          )}

          {text(hero, 'scarcity_note') && (
            <p className="inline-flex rounded-full border border-gold-200 bg-gold-50 px-3 py-1 text-sm font-bold text-gold-700">
              {text(hero, 'scarcity_note')}
            </p>
          )}
        </div>

        <div className="relative order-1 aspect-[4/5] w-full md:aspect-square lg:order-2">
          {/* Dos imágenes distintas por viewport: la vertical llena mejor el
              móvil, donde llega la mayor parte del tráfico de campañas. */}
          {mobile && (
            <div className="relative block h-full w-full md:hidden">
              <Image
                src={mobile}
                alt={headline}
                fill
                priority
                sizes="100vw"
                className="rounded-[2rem] border-4 border-white object-cover shadow-2xl"
              />
            </div>
          )}
          {desktop && (
            <div className="relative hidden h-full w-full md:block">
              <Image
                src={desktop}
                alt={headline}
                fill
                priority
                sizes="50vw"
                className="rounded-[2rem] border-4 border-white object-contain shadow-2xl"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Hotspots({ content, assets }: ContentProps & AssetProps) {
  const data = section(content, 'hotspots');
  const image = assetUrl(data.image, assets);
  const points = list(data, 'points').flatMap((point) => {
    const title = text(point, 'title');
    const description = text(point, 'description');
    const x = num(point, 'x');
    const y = num(point, 'y');
    return title && description && x !== undefined && y !== undefined
      ? [{ title, description, x, y }]
      : [];
  });
  const title = text(data, 'title');
  if (!image || !title || points.length === 0) return null;

  return (
    <section className="bg-white px-6 py-20 md:py-28">
      <header className="mx-auto mb-12 max-w-3xl text-center">
        {text(data, 'eyebrow') ? <span className="text-sm font-bold uppercase tracking-widest text-gold-600">{text(data, 'eyebrow')}</span> : null}
        <h2 className="mt-4 font-serif text-3xl font-bold md:text-5xl">{title}</h2>
        {text(data, 'description') ? <p className="mt-4 text-lg text-coffee-600">{text(data, 'description')}</p> : null}
      </header>
      <HotspotsInteractivos image={image} title={title} points={points} />
    </section>
  );
}

function Recipes({ content, assets }: ContentProps & AssetProps) {
  const data = section(content, 'recipes');
  const recipes = list(data, 'items').flatMap((item) => {
    const title = text(item, 'title');
    const ingredients = text(item, 'ingredients');
    const steps = text(item, 'steps');
    if (!title || !ingredients || !steps) return [];
    return [{
      title,
      subtitle: text(item, 'subtitle'),
      time: text(item, 'time'),
      ingredients,
      steps,
      proSecret: text(item, 'pro_secret'),
      image: assetUrl(item.image, assets),
    }];
  });
  if (recipes.length === 0) return null;
  return (
    <section id="recetas" className="scroll-mt-20 border-t border-coffee-200 bg-coffee-50 px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <header className="mx-auto mb-12 max-w-4xl text-center">
          {text(data, 'eyebrow') ? <span className="text-sm font-bold uppercase tracking-widest text-gold-600">{text(data, 'eyebrow')}</span> : null}
          <h2 className="mt-4 font-serif text-3xl font-bold md:text-5xl">
            {text(data, 'title')}
            {text(data, 'title_highlight') ? <><br /><span className="text-coffee-600">{text(data, 'title_highlight')}</span></> : null}
          </h2>
        </header>
        <RecetasInteractivas recipes={recipes} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Problem({ content }: ContentProps) {
  const problem = section(content, 'problem');
  const points = list(problem, 'points');
  if (points.length === 0) return null;

  return (
    <section id="experiencia" className="scroll-mt-20 border-t border-coffee-100 bg-white px-6 py-20 md:py-28">
      <div className="mx-auto max-w-7xl">
        <header className="mb-16 text-center">
          {text(problem, 'eyebrow') && (
            <span className="rounded-full border border-gold-200 bg-coffee-50 px-6 py-2.5 text-sm font-bold uppercase tracking-[0.2em] text-gold-600">
              {text(problem, 'eyebrow')}
            </span>
          )}
          <h2 className="mt-8 font-serif text-3xl font-bold leading-tight md:text-5xl">
            {text(problem, 'title')}
            {text(problem, 'title_highlight') && (
              <>
                <br />
                <span className="bg-gradient-to-r from-coffee-600 to-coffee-400 bg-clip-text text-transparent">
                  {text(problem, 'title_highlight')}
                </span>
              </>
            )}
          </h2>
        </header>

        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {text(problem, 'video_url') && (
            <figure className="flex flex-col items-center">
              <video
                className="w-full rounded-[2rem] shadow-2xl"
                controls
                playsInline
                preload="metadata"
              >
                <source src={text(problem, 'video_url')} type="video/mp4" />
              </video>
              {text(problem, 'video_caption') && (
                <figcaption className="mt-6 max-w-sm text-center italic text-coffee-400">
                  {text(problem, 'video_caption')}
                </figcaption>
              )}
            </figure>
          )}

          <div className="space-y-8">
            {points.map((point, i) => (
              <article
                key={i}
                className="rounded-[2rem] border border-coffee-100 bg-coffee-50 p-6 shadow-sm md:p-10"
              >
                <h3 className="mb-4 text-2xl font-bold md:text-3xl">
                  {i + 1}. {text(point, 'title')}
                </h3>
                <p className="text-lg leading-relaxed text-coffee-700">
                  <span className="font-bold text-red-500">Lo que pasa hoy:</span>{' '}
                  {text(point, 'mistake')}
                </p>
                <p className="mt-3 text-lg leading-relaxed text-coffee-700">
                  <span className="font-bold text-green-600">La solución:</span>{' '}
                  {text(point, 'solution')}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Gallery({ content, assets }: ContentProps & AssetProps) {
  const gallery = section(content, 'gallery');
  const items = list(gallery, 'items');
  if (items.length === 0) return null;

  return (
    <section className="bg-white px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <header className="mb-16 text-center">
          {text(gallery, 'eyebrow') && (
            <span className="text-sm font-bold uppercase tracking-widest text-gold-600">
              {text(gallery, 'eyebrow')}
            </span>
          )}
          <h2 className="mt-4 font-serif text-3xl font-bold md:text-4xl">
            {text(gallery, 'title')}
          </h2>
        </header>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => {
            const src = assetUrl(item.image, assets);
            return (
              <article
                key={i}
                className="group relative aspect-square overflow-hidden rounded-3xl bg-coffee-900 shadow-lg"
              >
                {src && (
                  <Image
                    src={src}
                    alt={text(item, 'title') ?? ''}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover opacity-80 transition duration-700 group-hover:scale-110"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-6 pb-8">
                  <h3 className="mb-2 text-xl font-bold text-white">{text(item, 'title')}</h3>
                  <p className="text-sm leading-relaxed text-gray-200">
                    {text(item, 'description')}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Bundle({ content, assets }: ContentProps & AssetProps) {
  const bundle = section(content, 'bundle');
  const items = list(bundle, 'items');
  if (items.length === 0) return null;

  return (
    <section id="kit" className="relative scroll-mt-20 overflow-hidden bg-coffee-900 px-6 py-24 text-white md:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold-600/10 blur-[100px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        <header className="mb-16 text-center md:mb-24">
          {text(bundle, 'eyebrow') && (
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-gold-400 md:text-sm">
              {text(bundle, 'eyebrow')}
            </span>
          )}
          <h2 className="mt-6 font-serif text-4xl font-bold leading-none tracking-tight md:text-6xl">
            {text(bundle, 'title')}
            {text(bundle, 'title_highlight') && (
              <>
                <br />
                <span className="bg-gradient-to-r from-gold-300 via-gold-500 to-gold-200 bg-clip-text text-transparent">
                  {text(bundle, 'title_highlight')}
                </span>
              </>
            )}
          </h2>
          {text(bundle, 'intro') && (
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-coffee-200">
              {text(bundle, 'intro')}
            </p>
          )}
        </header>

        <div className="grid items-stretch gap-8 md:grid-cols-2 md:gap-16">
          {items.map((item, i) => {
            const src = assetUrl(item.image, assets);
            const value = num(item, 'value_amount');
            return (
              <article
                key={i}
                className="relative flex flex-col overflow-hidden rounded-[2.5rem] border border-white/5 bg-coffee-950/80 p-8 shadow-2xl backdrop-blur-xl md:p-12"
              >
                <span className="absolute right-0 top-0 rounded-bl-3xl bg-gradient-to-r from-gold-500 to-gold-600 px-8 py-3 text-sm font-bold tracking-widest">
                  INCLUIDO
                </span>

                {src && (
                  <div className="relative mb-8 h-64 md:h-80">
                    <Image
                      src={src}
                      alt={text(item, 'name') ?? ''}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-contain"
                    />
                  </div>
                )}

                <h3 className="mb-4 font-serif text-3xl font-bold leading-tight md:text-4xl">
                  {text(item, 'name')}
                  {text(item, 'subtitle') && (
                    <>
                      <br />
                      <span className="text-2xl text-gray-400">{text(item, 'subtitle')}</span>
                    </>
                  )}
                </h3>

                <p className="mb-8 border-l-2 border-gold-500/30 pl-4 leading-relaxed text-gray-400">
                  {text(item, 'description')}
                </p>

                <ul className="mt-auto space-y-4">
                  {list(item, 'bullets').map((bullet, j) => (
                    <li key={j} className="flex items-center gap-3 text-gray-200">
                      <span className="rounded-full bg-gold-500/10 p-2 text-gold-500">
                        <CheckIcon />
                      </span>
                      <span className="font-medium">{text(bullet, 'text')}</span>
                    </li>
                  ))}
                  {value !== undefined && (
                    <li className="flex items-center gap-3 text-gray-200">
                      <span className="rounded-full bg-gold-500/10 p-2 text-gold-500">
                        <CheckIcon />
                      </span>
                      <span className="font-medium">
                        Valorado en {formatMoney(value, 'COP')}
                      </span>
                    </li>
                  )}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Savings({ content }: ContentProps) {
  const savings = section(content, 'savings');
  const currentLines = list(savings, 'current_lines');
  const alternativeLines = list(savings, 'alternative_lines');
  if (currentLines.length === 0 && alternativeLines.length === 0) return null;

  const annual = num(savings, 'current_annual_amount');

  return (
    <section id="ahorro" className="scroll-mt-20 border-t border-coffee-200 bg-coffee-50 px-6 py-20 md:py-32">
      <div className="mx-auto max-w-6xl">
        <header className="mb-16 text-center">
          <h2 className="mb-6 font-serif text-4xl font-bold md:text-5xl">
            {text(savings, 'title')}
          </h2>
          {text(savings, 'intro') && (
            <p className="mx-auto max-w-2xl text-xl text-coffee-600">{text(savings, 'intro')}</p>
          )}
        </header>

        <div className="flex flex-col overflow-hidden rounded-3xl border border-coffee-100 bg-white shadow-2xl md:flex-row">
          <div className="w-full border-b-2 border-dashed border-gray-300 bg-[#f8f5f2] p-8 md:w-1/2 md:border-b-0 md:border-r-2 md:p-12">
            <div className="mx-auto max-w-sm border border-gray-200 bg-white p-6 font-mono text-sm shadow-sm">
              <h3 className="border-b-2 border-dashed border-gray-300 pb-4 text-center text-lg font-bold uppercase tracking-widest">
                {text(savings, 'current_label') ?? 'Hoy'}
              </h3>
              <ul className="my-4 space-y-3">
                {currentLines.map((line, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{text(line, 'label')}</span>
                    <span>{formatAmount(num(line, 'amount'))}</span>
                  </li>
                ))}
              </ul>
              {annual !== undefined && (
                <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-center">
                  <p className="mb-1 text-xs font-bold uppercase tracking-widest text-red-500">
                    Gasto anual
                  </p>
                  <p className="font-sans text-3xl font-bold text-red-600">
                    {formatMoney(annual, 'COP')}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col justify-center bg-coffee-900 p-8 text-white md:w-1/2 md:p-12">
            <h3 className="mb-6 font-serif text-3xl font-bold text-gold-400">
              {text(savings, 'alternative_label') ?? 'En casa'}
            </h3>
            <ul className="mb-8 space-y-6">
              {alternativeLines.map((line, i) => (
                <li key={i} className="flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-lg text-gray-300">{text(line, 'label')}</span>
                  <span className="font-mono text-2xl font-bold">{text(line, 'value')}</span>
                </li>
              ))}
            </ul>

            {text(savings, 'savings_headline') && (
              <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-center backdrop-blur-md">
                <p className="mb-2 text-sm uppercase tracking-widest text-gray-300">
                  {text(savings, 'savings_headline')}
                </p>
                {text(savings, 'savings_note') && (
                  <p className="mt-2 text-xs text-gray-400">{text(savings, 'savings_note')}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function SocialProof({ content, assets }: ContentProps & AssetProps) {
  const proof = section(content, 'social_proof');
  const testimonials = list(proof, 'testimonials');
  // Sin testimonios reales no se dibuja la sección. Un bloque de prueba social
  // vacío resta credibilidad, y rellenarlo con ejemplos sería inventarla.
  if (testimonials.length === 0) return null;

  return (
    <section className="bg-white px-6 py-16 md:py-24">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-12 text-center font-serif text-3xl font-bold md:text-4xl">
          {text(proof, 'title')}
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((item, i) => {
            const avatar = assetUrl(item.image, assets);
            return (
              <figure
                key={i}
                className="rounded-3xl border border-coffee-100 bg-coffee-50 p-6 shadow-sm"
              >
                <blockquote className="leading-relaxed text-coffee-700">
                  {text(item, 'text')}
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  {avatar && (
                    <Image
                      src={avatar}
                      alt=""
                      width={44}
                      height={44}
                      className="rounded-full object-cover"
                    />
                  )}
                  <div>
                    <p className="font-bold">{text(item, 'name')}</p>
                    <p className="text-sm text-coffee-500">{text(item, 'location')}</p>
                  </div>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Offer({
  content,
  siteId,
  priceAmount,
  compareAtAmount,
  currency,
  isPreview,
}: ContentProps & {
  siteId: string;
  priceAmount?: number;
  compareAtAmount?: number;
  currency: Currency;
  isPreview?: boolean;
}) {
  const offer = section(content, 'offer');
  const discount =
    compareAtAmount !== undefined && priceAmount !== undefined
      ? savingsPercent(compareAtAmount, priceAmount)
      : null;

  return (
    <section
      id="oferta"
      className="scroll-mt-20 bg-gradient-to-b from-coffee-50 to-white px-6 py-16 md:py-24"
    >
      <div className="mx-auto grid max-w-7xl items-start gap-10 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 space-y-8 text-center lg:order-1 lg:text-left">
          {text(offer, 'eyebrow') && (
            <span className="block text-sm font-bold uppercase tracking-widest text-red-500">
              {text(offer, 'eyebrow')}
            </span>
          )}
          <h2 className="font-serif text-4xl font-bold leading-tight md:text-5xl">
            {text(offer, 'title')}
          </h2>
          {text(offer, 'description') && (
            <p className="text-lg leading-relaxed text-coffee-600">
              {text(offer, 'description')}
            </p>
          )}

          <ul className="space-y-4">
            {list(offer, 'included').map((item, i) => (
              <li
                key={i}
                className="mx-auto flex max-w-md items-center gap-4 rounded-2xl border border-coffee-100 bg-white p-4 shadow-sm lg:mx-0"
              >
                <span className="rounded-full bg-green-100 p-2 text-green-700">
                  <CheckIcon />
                </span>
                <div className="text-left">
                  <p className="font-bold">{text(item, 'title')}</p>
                  <p className="text-sm text-coffee-500">{text(item, 'description')}</p>
                </div>
              </li>
            ))}
          </ul>

          {list(offer, 'guarantees').length > 0 && (
            <ul className="grid grid-cols-2 gap-4">
              {list(offer, 'guarantees').map((item, i) => (
                <li key={i} className="rounded-xl bg-coffee-50 p-4 text-center">
                  <span className="block text-sm font-bold">{text(item, 'title')}</span>
                  <span className="text-xs text-coffee-500">{text(item, 'description')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <div className="relative mx-auto w-full max-w-md rounded-[2rem] border-4 border-gold-500/30 bg-white p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] md:p-8 lg:max-w-none">
            {bool(offer, 'show_countdown') && text(offer, 'countdown_ends_at') ? (
              <ContadorOferta
                endsAt={text(offer, 'countdown_ends_at') ?? ''}
                label={text(offer, 'countdown_label') ?? 'La oferta termina en'}
              />
            ) : null}
            {text(offer, 'stock_note') && (
              <span className="absolute right-0 top-0 rounded-bl-2xl bg-gold-500 px-4 py-2 text-[10px] font-bold tracking-wider text-white">
                {text(offer, 'stock_note')}
              </span>
            )}

            <div className="mb-6 text-center">
              <p className="text-[10px] font-bold uppercase tracking-widest text-coffee-400">
                Precio total hoy
              </p>
              {compareAtAmount !== undefined && (
                <span className="block text-xl font-medium text-red-500 line-through opacity-60">
                  {formatMoney(compareAtAmount, currency)}
                </span>
              )}
              {priceAmount !== undefined && (
                <span className="block text-5xl font-extrabold tracking-tighter md:text-6xl">
                  {formatMoney(priceAmount, currency)}
                </span>
              )}
              {discount !== null && (
                <span className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
                  Ahorras {discount}%
                </span>
              )}
            </div>

            <OrderForm
              siteId={siteId}
              ctaLabel={text(offer, 'cta_label') ?? 'Pedir ahora'}
              ctaSubtext={text(offer, 'cta_subtext')}
              isPreview={isPreview}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Faq({ content }: ContentProps) {
  const faq = section(content, 'faq');
  const items = list(faq, 'items');
  if (items.length === 0) return null;

  return (
    <section className="border-t border-coffee-200 bg-coffee-50 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-10 text-center font-serif text-3xl font-bold">
          {text(faq, 'title') ?? 'Preguntas frecuentes'}
        </h2>
        <div className="space-y-4">
          {items.map((item, i) => (
            /* `<details>` nativo en vez de estado en React: funciona sin
               JavaScript, es accesible por teclado de serie y no añade peso. */
            <details
              key={i}
              className="group overflow-hidden rounded-xl border border-coffee-100 bg-white open:border-gold-500 open:shadow-md"
            >
              <summary className="flex cursor-pointer items-center justify-between p-5 font-serif text-lg font-bold text-coffee-700 group-open:text-coffee-900">
                {text(item, 'question')}
                <span className="ml-4 shrink-0 text-gold-600 transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <div className="px-5 pb-5 leading-relaxed text-coffee-600">
                {text(item, 'answer')}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

/** CTA fijo en móvil: la mayoría del tráfico de campañas llega desde el teléfono. */
function StickyCta({ content }: ContentProps) {
  const offer = section(content, 'offer');
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee-200 bg-white/95 p-3 backdrop-blur md:hidden">
      <a
        href="#oferta"
        className="block rounded-xl bg-coffee-900 py-4 text-center text-lg font-bold text-white"
      >
        {text(offer, 'cta_label') ?? 'Pedir ahora'}
      </a>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function formatAmount(amount: number | undefined): string {
  return amount === undefined ? '' : formatMoney(amount, 'COP');
}
