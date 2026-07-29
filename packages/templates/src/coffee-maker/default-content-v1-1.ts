import type { ContentJson } from '@nitro-web/contracts';
import { coffeeMakerDefaultContent } from './default-content';

export const coffeeMakerDefaultContentV11: ContentJson = {
  ...coffeeMakerDefaultContent,
  hotspots: {
    eyebrow: 'Ingeniería al detalle',
    title: 'Diseñada para resultados profesionales',
    description: 'Explora las piezas que convierten una preparación cotidiana en una experiencia de cafetería.',
    points: [
      { title: 'Vaporizador profesional', description: 'Vapor seco para crear microespuma sedosa y practicar latte art.', x: 84, y: 40 },
      { title: 'Portafiltro de alto desempeño', description: 'Extracción estable y uniforme para aprovechar mejor cada grano.', x: 53, y: 60 },
      { title: 'Cuerpo de acero inoxidable', description: 'Construcción robusta, durable y fácil de limpiar.', x: 29, y: 65 },
    ],
  },
  recipes: {
    eyebrow: 'Tu menú diario',
    title: 'Resultados de cafetería',
    title_highlight: 'sin equipos industriales',
    items: [
      {
        title: 'Espresso perfecto',
        subtitle: 'El punto de partida',
        time: '1 min',
        ingredients: '18 g de café recién molido\n60 ml de agua',
        steps: 'Muele el café fino\nCompacta de forma uniforme\nExtrae durante 25 a 30 segundos',
        pro_secret: 'Ajusta primero la molienda; es la variable que más cambia el resultado.',
      },
      {
        title: 'Cappuccino',
        subtitle: 'Textura de terciopelo',
        time: '5 min',
        ingredients: '1 espresso\n150 ml de leche fría\nCacao opcional',
        steps: 'Prepara el espresso\nPurga el vaporizador\nTexturiza la leche sin hervirla\nSirve lentamente',
        pro_secret: 'Detén el vapor cuando la jarra esté caliente pero todavía puedas tocarla.',
      },
    ],
  },
  offer: {
    ...coffeeMakerDefaultContent.offer,
    show_countdown: false,
    countdown_label: 'La oferta termina en',
    countdown_ends_at: '',
  },
};
