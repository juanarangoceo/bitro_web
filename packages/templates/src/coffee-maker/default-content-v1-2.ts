import type { ContentJson } from '@nitro-web/contracts';
import { coffeeMakerDefaultContentV11 } from './default-content-v1-1';

/** Contenido fiel al sitio Coffee Maker Pro usado como referencia. */
export const coffeeMakerDefaultContentV12: ContentJson = {
  ...coffeeMakerDefaultContentV11,
  problem: {
    ...coffeeMakerDefaultContentV11.problem,
    video_url:
      'https://res.cloudinary.com/dohwyszdj/video/upload/v1766264202/video_reel_hcfoyo.mp4',
    video_caption: 'Mira la extracción real a 20 bares de la Coffee Maker Pro',
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
    items: [
      {
        name: 'Molino de muelas', subtitle: 'Edición titanio',
        description: 'La consistencia es clave. Muelas cónicas de acero para conseguir una extracción uniforme.',
        value_amount: 299000,
        bullets: [{ text: '25 ajustes de molienda' }, { text: 'Muelas cónicas de acero' }],
      },
      {
        name: 'Guía Barista en 5 minutos', subtitle: 'Libro digital',
        description: 'Recetas y tiempos exactos para que tu primera taza salga bien, aunque nunca hayas usado una espresso.',
        value_amount: 99000,
        bullets: [{ text: 'Recetas paso a paso' }, { text: 'Acceso inmediato' }],
      },
    ],
  },
  savings: {
    ...coffeeMakerDefaultContentV11.savings,
    current_annual_amount: 7300000,
  },
};
