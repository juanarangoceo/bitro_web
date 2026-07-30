import { afterEach, describe, expect, it } from 'vitest';
import { assetUrl } from './content';

const supabaseOriginal = process.env.NEXT_PUBLIC_SUPABASE_URL;

afterEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseOriginal;
});

describe('assetUrl', () => {
  it('sirve un recurso propio de plantilla desde el mismo origen', () => {
    expect(
      assetUrl('imagen', {
        imagen: 'template:/templates/coffee-maker/tinto.png',
      }),
    ).toBe('/templates/coffee-maker/tinto.png');
  });

  it('mantiene los assets del tenant dentro de Supabase Storage', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';
    expect(
      assetUrl('imagen', {
        imagen: 'tenant/site/producto.webp',
      }),
    ).toBe(
      'https://proyecto.supabase.co/storage/v1/object/public/site-assets/tenant/site/producto.webp',
    );
  });
});
