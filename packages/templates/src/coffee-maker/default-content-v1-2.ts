import type { ContentJson } from '@nitro-web/contracts';
import { coffeeMakerDefaultContentV11 } from './default-content-v1-1';

/** Contenido fiel al sitio Coffee Maker Pro usado como referencia. */
export const coffeeMakerDefaultContentV12: ContentJson = {
  ...coffeeMakerDefaultContentV11,
  brand: {
    name: 'Coffee Maker',
    name_accent: 'Pro',
    tagline: 'Tienda oficial',
    nav_links: [
      { label: 'Experiencia', anchor: 'experiencia' },
      { label: 'Resultados', anchor: 'recetas' },
      { label: 'Kit regalo', anchor: 'kit' },
      { label: 'Ahorro', anchor: 'ahorro' },
    ],
    cta_label: 'Comprar ahora',
  },
  problem: {
    ...coffeeMakerDefaultContentV11.problem,
    video_url:
      'https://res.cloudinary.com/dohwyszdj/video/upload/v1766264202/video_reel_hcfoyo.mp4',
    video_caption: 'Mira la extracción real a 20 bares de la Coffee Maker Pro',
  },
  hotspots: {
    ...coffeeMakerDefaultContentV11.hotspots,
    points: [
      ...(coffeeMakerDefaultContentV11.hotspots?.points as unknown[] ?? []),
      {
        title: 'Bandeja calientatazas',
        description: 'Mantiene las tazas a temperatura antes de servir, para que el espresso no se enfríe al caer.',
        x: 50,
        y: 8,
      },
    ],
  },
  gallery: {
    ...coffeeMakerDefaultContentV11.gallery,
    items: [
      { title: 'La crema perfecta', description: 'Densa, color avellana y capaz de sostener el azúcar. El sello de calidad de un espresso real.' },
      { title: 'Micro-espuma de seda', description: 'Potencia de vapor seco para texturizar leche brillante y elástica. Tu latte art empieza aquí.' },
      { title: 'Frescura instantánea', description: 'Rompe el grano segundos antes. Los aceites esenciales van a tu taza, no al aire.' },
      { title: 'Acero inoxidable premium', description: 'Robusta, pesada y elegante. No es plástico: es maquinaria comercial para tu cocina.' },
    ],
  },
  recipes: {
    eyebrow: 'Tu menú diario',
    title: 'Resultados de cafetería de especialidad, sin el costo de equipos industriales.',
    title_highlight: 'Calidad accesible y garantizada.',
    items: [
      {
        title: 'Tinto perfecto', subtitle: 'El clásico colombiano', time: '1 min',
        ingredients: '18 g de café en grano (molienda fina)\n60 ml de agua a 92 °C\nSin azúcar',
        steps: 'Muele tus granos frescos con el molino de regalo.\nCompacta con fuerza media usando el tamper.\nExtrae por 25 segundos para obtener la crema perfecta.',
        pro_secret: 'El secreto no es el azúcar, es la molienda fresca. El café premolido pierde gran parte de sus aromas muy rápido.',
      },
      {
        title: 'Cappuccino de autor', subtitle: 'Textura de terciopelo', time: '5 min',
        ingredients: '1 espresso simple\n150 ml de leche entera fría\nCacao en polvo',
        steps: 'Extrae el espresso en una taza ancha.\nPurga el vaporizador.\nTexturiza la leche inclinando la jarra a 45 grados.\nVierte creando un círculo blanco en el centro.',
        pro_secret: 'Para latte art, la leche no debe hervir. Detén el vapor alrededor de 65 °C.',
      },
      {
        title: 'Affogato italiano', subtitle: 'Postre y café en uno', time: '2 min',
        ingredients: '2 bolas de helado de vainilla\n1 espresso doble intenso\nNueces trituradas',
        steps: 'Sirve el helado en una copa fría.\nPrepara el espresso doble directamente sobre el helado.\nDecora con nueces.',
        pro_secret: 'Usa una molienda más fina y una extracción corta y dulce para contrastar con el helado.',
      },
      {
        title: 'Cold brew express', subtitle: 'Refrescante y energizante', time: '3 min',
        ingredients: '1 espresso doble\nHielo grande\n100 ml de agua tónica\nRodaja de limón',
        steps: 'Llena el vaso con hielo.\nAgrega la tónica y el limón.\nVierte el espresso suavemente para que flote.',
        pro_secret: 'La tónica resalta las notas cítricas de los cafés colombianos de altura.',
      },
    ],
  },
  bundle: {
    ...coffeeMakerDefaultContentV11.bundle,
    eyebrow: 'Solo por hoy',
    title: 'Tu cafetería en casa',
    title_highlight: 'completa y gratis',
    badge_label: 'GRATIS',
    intro: 'Equipamiento profesional valorado en $430.000, incluido sin costo adicional con tu pedido.',
    items: [
      {
        name: 'Molino de muelas', subtitle: 'Edición titanio',
        description: 'La consistencia es clave. Muelas cónicas de acero para conseguir una extracción uniforme.',
        value_amount: 180000,
        bullets: [{ text: '25 ajustes de molienda' }, { text: 'Muelas cónicas de acero' }],
      },
      {
        name: 'Guía Barista en 5 minutos', subtitle: 'Libro digital',
        description: 'Recetas y tiempos exactos para que tu primera taza salga bien, aunque nunca hayas usado una espresso.',
        value_amount: 47000,
        bullets: [{ text: 'Recetas paso a paso' }, { text: 'Acceso inmediato' }],
      },
    ],
  },
  savings: {
    ...coffeeMakerDefaultContentV11.savings,
    current_lines: [
      { label: 'Cappuccino grande', amount: 12000 },
      { label: 'Leche vegetal', amount: 2000 },
      { label: 'Acompañamiento', amount: 8000 },
    ],
    current_total_label: 'Total diario',
    current_total_amount: 22000,
    current_annual_amount: 8030000,
    current_note: 'Gracias por su visita',
    alternative_lines: [
      { label: 'Costo por taza', value: '$500' },
      { label: 'Tiempo de preparación', value: '2 min' },
      { label: 'Gusto', value: 'Infinito' },
    ],
    savings_headline: 'Tu ahorro el primer año',
    savings_value: '$7.5M+',
    savings_note: 'Calculado sobre tu consumo diario actual.',
  },
  offer: {
    ...coffeeMakerDefaultContentV11.offer,
    product_name: 'Estación Espresso Pro',
    product_subtitle: 'Calidad de cafetería',
    bonuses_label: 'Bonos activos',
    bonuses: [
      { label: 'Molino ajustable', value_amount: 180000, badge: 'GRATIS' },
      { label: 'Guía Barista', value_amount: 47000, badge: 'GRATIS' },
    ],
    payment_label: 'Pasarela de pagos segura',
    payment_note: 'Pago contraentrega (efectivo)',
    closing_note: 'Compra 100% protegida.',
  },
  footer: {
    about: 'Café de especialidad en casa, con molienda fresca y extracción profesional.',
    explore_label: 'Explora',
    explore_links: [
      { label: 'Experiencia', anchor: 'experiencia' },
      { label: 'Recetas', anchor: 'recetas' },
      { label: 'Kit incluido', anchor: 'kit' },
      { label: 'Ahorro', anchor: 'ahorro' },
    ],
    legal_label: 'Legal y garantías',
    // Sin URLs por defecto: un enlace legal inventado es peor que ausente. El
    // cliente pone los suyos y la validación de publicación exige que la lista
    // esté completa o vacía, nunca a medias.
    legal_links: [],
    contact_label: 'Compra con confianza',
    contact_lines: [
      { text: 'Envío gratis · Pago contraentrega' },
      { text: 'Garantía de 12 meses' },
    ],
    copyright: 'Todos los derechos reservados.',
  },
};
