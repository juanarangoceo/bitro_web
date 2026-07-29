/**
 * Contenido demostrativo de la plantilla Coffee Maker.
 *
 * Es lo primero que ve un cliente al crear un sitio: sirve de preview del
 * catálogo y de andamio para que edite en lugar de enfrentarse a campos vacíos
 * (§4.3, "Empezar con contenido de ejemplo").
 *
 * Los textos provienen de la landing real en producción, así que demuestran una
 * estructura de conversión que ya funciona, no un lorem ipsum.
 *
 * **Sin imágenes.** Los campos de imagen referencian `assets.id` del tenant, y
 * un sitio recién creado no tiene assets. El checklist de primera publicación
 * exige subirlas antes de publicar, que es justo la fricción correcta: nadie
 * debería publicar una landing con las fotos de otro producto.
 */

import type { ContentJson } from '@nitro-web/contracts';

export const coffeeMakerDefaultContent: ContentJson = {
  hero: {
    headline: 'Tu propia barra de café',
    headline_highlight: 'Barista en casa u oficina',
    subheadline:
      'Olvídate del café quemado. Disfruta espressos, cappuccinos y lattes con calidad de cafetería italiana, sin salir de tu espacio.',
    cta_label: 'Quiero la mía',
    badges: [
      { text: 'Envío gratis' },
      { text: 'Paga al recibir' },
      { text: 'Garantía 1 año' },
    ],
    scarcity_note: 'Alta demanda: últimas unidades',
  },

  problem: {
    eyebrow: 'La realidad',
    title: '¿Por qué tu café en casa no sabe',
    title_highlight: 'como el de tu cafetería favorita?',
    video_caption: 'Mira la extracción real a 20 bares',
    points: [
      {
        title: 'El problema del café oxidado',
        mistake: 'Usas café pre-molido de supermercado, que pierde sus aromas en minutos.',
        solution:
          'Incluimos el molino automático: rompes el grano diez segundos antes de beberlo.',
      },
      {
        title: 'Presión insuficiente',
        mistake: 'Tu máquina actual tiene 3 a 9 bares reales, o 15 bares solo en la etiqueta.',
        solution:
          '20 bares reales de bomba italiana. Es la única forma de obtener la crema avellana.',
      },
    ],
  },

  gallery: {
    eyebrow: 'Detalles que enamoran',
    title: 'Ingeniería italiana, diseño moderno',
    items: [
      {
        title: 'La crema perfecta',
        description:
          'Densa, color avellana y capaz de sostener el azúcar. El sello de un espresso real.',
      },
      {
        title: 'Micro-espuma de seda',
        description:
          'Vapor seco para texturizar leche brillante y elástica. Tu latte art empieza aquí.',
      },
      {
        title: 'Frescura instantánea',
        description:
          'Rompe el grano segundos antes. Los aceites esenciales van a tu taza, no al aire.',
      },
      {
        title: 'Acero inoxidable premium',
        description: 'Robusta, pesada y elegante. No es plástico: es maquinaria para tu cocina.',
      },
    ],
  },

  bundle: {
    eyebrow: 'Incluido sin costo',
    title: 'Tu cafetería en casa',
    title_highlight: 'completa',
    intro: 'Equipamiento profesional incluido sin costo adicional con tu pedido.',
    items: [
      {
        name: 'Molino de muelas',
        subtitle: 'Edición titanio',
        description:
          'La consistencia es clave. Olvídate de las cuchillas: muelas cónicas de acero para una extracción uniforme.',
        bullets: [{ text: '25 ajustes de molienda' }, { text: 'Muelas cónicas de acero' }],
      },
      {
        name: 'Guía Barista en 5 minutos',
        subtitle: 'Libro digital',
        description:
          'Las recetas y los tiempos exactos para que tu primera taza salga bien, aunque nunca hayas usado una espresso.',
        bullets: [{ text: 'Recetas paso a paso' }, { text: 'Acceso inmediato' }],
      },
    ],
  },

  savings: {
    title: 'Matemáticas simples',
    intro: 'Tu hábito actual de café está financiando la cafetería. Es hora de financiar lo tuyo.',
    current_label: 'Lo que gastas hoy',
    current_lines: [
      { label: 'Cappuccino grande', amount: 12000 },
      { label: 'Acompañamiento', amount: 8000 },
    ],
    alternative_label: 'La experiencia en casa',
    alternative_lines: [
      { label: 'Costo por taza', value: '$500' },
      { label: 'Tiempo de preparación', value: '2 min' },
    ],
    savings_headline: 'Tu ahorro el primer año',
    savings_note: 'Calculado sobre tu consumo diario actual.',
  },

  social_proof: {
    title: 'Lo que dicen quienes ya la tienen',
    testimonials: [],
  },

  offer: {
    eyebrow: 'Oferta por tiempo limitado',
    title: 'Todo lo que necesitas para ser barista en casa',
    description:
      'No solo compras una máquina: obtienes el equipo completo para dominar el café desde el primer día.',
    cta_label: 'Obtener oferta',
    cta_subtext: 'Pago contraentrega • Envío asegurado',
    included: [
      { title: 'Molino eléctrico', description: 'Molienda fresca en cada taza' },
      { title: 'Guía Barista', description: 'Recetas paso a paso' },
    ],
    guarantees: [
      { title: 'Envío gratis', description: 'A todo el país' },
      { title: 'Garantía total', description: '12 meses' },
    ],
    show_countdown: false,
    stock_note: 'Stock limitado',
  },

  faq: {
    title: 'Preguntas frecuentes',
    items: [
      {
        question: '¿Qué diferencia hay entre 15 y 20 bares?',
        answer:
          'La presión determina la extracción. Con 20 bares se extraen mejor los aceites esenciales del grano, y el resultado es un espresso con más cuerpo, más aroma y esa crema dorada y espesa del café de especialidad.',
      },
      {
        question: '¿Qué viene incluido en la caja?',
        answer:
          'La máquina, el portafiltro profesional, filtro sencillo y doble, cuchara medidora con compactador y el manual de uso. Más los bonos de la oferta actual.',
      },
      {
        question: '¿Cómo funciona la garantía?',
        answer:
          'Tienes garantía de satisfacción durante los primeros 30 días y garantía técnica por defectos de fabricación. Si algo falla, lo resolvemos.',
      },
      {
        question: '¿Cuánto tarda el envío y cómo pago?',
        answer:
          'El envío es gratis a todo el país y tarda entre 2 y 5 días hábiles. Manejamos pago contraentrega: pagas cuando recibes el producto.',
      },
    ],
  },

  seo: {
    title: 'Cafetera espresso profesional | Barista en casa',
    description:
      'Espressos y cappuccinos con calidad de cafetería en tu casa. Envío gratis y pago contraentrega a todo el país.',
  },
};
