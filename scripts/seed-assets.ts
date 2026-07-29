/**
 * Sube las imágenes de un sitio y las referencia desde su borrador.
 *
 * Hace las tres cosas que hay que hacer juntas o ninguna:
 *
 *   1. Sube el archivo a `site-assets`, bajo `<tenant_id>/<site_id>/<archivo>`.
 *   2. Registra la fila en `assets` con su `storage_path`, mime y dimensiones.
 *   3. Escribe `assets.id` en el campo del borrador que corresponde al slot.
 *
 * Sin el paso 3 el archivo existe pero la landing no lo muestra; sin el 2 el
 * contenido apuntaría a un id que no resuelve. El renderer traduce
 * `assets.id` → `storage_path` (ADR 0003), así que el contenido nunca guarda
 * una URL.
 *
 * Uso:
 *   pnpm db:seed-assets -- \
 *     --hero-mobile=_referencia/public/images/hero-mobile.webp \
 *     --hero-desktop=_referencia/public/images/hero-desktop.webp
 */

import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import { parseArgs } from 'node:util';

import { createSecretClient, type Json, type NitroWebClient } from '@nitro-web/db';

try {
  process.loadEnvFile('.env.local');
} catch {
  // Sin .env.local se sigue: en CI las variables llegan por el entorno.
}

const BUCKET = 'site-assets';

/**
 * Slot del manifest → dónde se escribe el id en el contenido.
 *
 * Solo los dos obligatorios: los demás slots son galerías con varios elementos
 * y su carga pertenece al editor, no a un script de arranque.
 */
const SLOTS = {
  'hero-mobile': { slot: 'hero_mobile', seccion: 'hero', campo: 'image_mobile' },
  'hero-desktop': { slot: 'hero_desktop', seccion: 'hero', campo: 'image_desktop' },
} as const;

type SlotKey = keyof typeof SLOTS;

const MIME_POR_EXTENSION: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const { values } = parseArgs({
  args: argumentos(),
  options: {
    tenant: { type: 'string', default: 'coffee-maker-pro' },
    site: { type: 'string', default: 'Cafetera Espresso' },
    'hero-mobile': { type: 'string' },
    'hero-desktop': { type: 'string' },
  },
});

main().catch((error: unknown) => {
  fallar(error instanceof Error ? error.message : String(error));
});

async function main(): Promise<void> {
  const pedidos = (Object.keys(SLOTS) as SlotKey[])
    .map((clave) => ({ clave, ruta: values[clave] as string | undefined }))
    .filter((p): p is { clave: SlotKey; ruta: string } => Boolean(p.ruta));

  if (pedidos.length === 0) {
    fallar(
      'No se indicó ninguna imagen. Banderas disponibles: ' +
        (Object.keys(SLOTS) as SlotKey[]).map((k) => `--${k}`).join(', '),
    );
  }

  const supabase = createSecretClient();
  const sitio = await cargarSitio(supabase, values.tenant as string, values.site as string);

  const asignaciones: { seccion: string; campo: string; assetId: string }[] = [];

  for (const pedido of pedidos) {
    const destino = SLOTS[pedido.clave];
    const assetId = await subirYRegistrar(supabase, {
      rutaLocal: pedido.ruta,
      tenantId: sitio.tenantId,
      siteId: sitio.siteId,
      slot: destino.slot,
    });
    asignaciones.push({ seccion: destino.seccion, campo: destino.campo, assetId });
  }

  await referenciarEnBorrador(supabase, sitio, asignaciones);

  console.log(`\n· Preview: /preview/${sitio.previewToken}`);
}

async function cargarSitio(
  supabase: NitroWebClient,
  tenantSlug: string,
  nombreSitio: string,
): Promise<{ siteId: string; tenantId: string; previewToken: string }> {
  const { data: tenant, error: errorTenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('slug', tenantSlug)
    .maybeSingle();

  if (errorTenant) fallar(`No se pudo leer 'tenants': ${errorTenant.message}`);
  if (!tenant) fallar(`No existe el tenant '${tenantSlug}'.`);

  const { data: sitio, error } = await supabase
    .from('sites')
    .select('id, preview_token')
    .eq('tenant_id', tenant.id)
    .eq('name', nombreSitio)
    .maybeSingle();

  if (error) fallar(`No se pudo leer 'sites': ${error.message}`);
  if (!sitio) fallar(`El tenant '${tenantSlug}' no tiene un sitio llamado '${nombreSitio}'.`);

  console.log(`✓ Sitio: ${nombreSitio} (${sitio.id})`);
  return { siteId: sitio.id, tenantId: tenant.id, previewToken: sitio.preview_token };
}

async function subirYRegistrar(
  supabase: NitroWebClient,
  params: { rutaLocal: string; tenantId: string; siteId: string; slot: string },
): Promise<string> {
  const contenido = await readFile(params.rutaLocal).catch(() => {
    fallar(`No se pudo leer '${params.rutaLocal}'.`);
  });

  const extension = extname(params.rutaLocal).toLowerCase();
  const mime = MIME_POR_EXTENSION[extension];
  if (!mime) {
    fallar(
      `Extensión '${extension}' no admitida. El bucket acepta ${Object.keys(MIME_POR_EXTENSION).join(', ')}. ` +
        'SVG está excluido a propósito: puede contener scripts.',
    );
  }

  const { width, height } = dimensiones(contenido, mime);

  // El slot va en el nombre para que la ruta se lea sola al depurar. El sufijo
  // de tiempo evita que reemplazar una imagen pise la que ya está publicada:
  // un snapshot vivo puede seguir apuntando a la anterior (§9).
  const nombre = `${params.slot}-${Date.now()}${extension}`;
  const storagePath = `${params.tenantId}/${params.siteId}/${nombre}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, contenido, { contentType: mime, upsert: false });

  if (errorSubida) fallar(`No se pudo subir '${basename(params.rutaLocal)}': ${errorSubida.message}`);

  const { data: asset, error: errorAsset } = await supabase
    .from('assets')
    .insert({
      tenant_id: params.tenantId,
      site_id: params.siteId,
      storage_path: storagePath,
      mime_type: mime,
      byte_size: contenido.byteLength,
      width,
      height,
      asset_slot: params.slot,
    })
    .select('id')
    .single();

  if (errorAsset || !asset) {
    // El archivo ya está arriba pero sin fila que lo represente: se borra para
    // no dejar un huérfano que nadie sabe de quién es ni si se puede limpiar.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    fallar(`No se pudo registrar el asset: ${errorAsset?.message ?? 'sin datos'}`);
  }

  const kb = Math.round(contenido.byteLength / 1024);
  const medidas = width && height ? `${width}×${height}` : 'dimensiones desconocidas';
  console.log(`✓ ${params.slot}: ${medidas}, ${kb} kB → ${asset.id}`);

  return asset.id;
}

/**
 * Escribe los ids en el borrador.
 *
 * Lee, fusiona y vuelve a escribir en lugar de sobrescribir la sección entera:
 * el borrador puede tener ediciones del cliente y solo estos campos deben
 * cambiar.
 */
async function referenciarEnBorrador(
  supabase: NitroWebClient,
  sitio: { siteId: string },
  asignaciones: { seccion: string; campo: string; assetId: string }[],
): Promise<void> {
  const { data: borrador, error } = await supabase
    .from('site_content_drafts')
    .select('content_json, revision')
    .eq('site_id', sitio.siteId)
    .maybeSingle();

  if (error) fallar(`No se pudo leer el borrador: ${error.message}`);
  if (!borrador) fallar('El sitio no tiene borrador. Corre antes: pnpm db:seed-site');

  const contenido = { ...((borrador.content_json ?? {}) as Record<string, unknown>) };

  for (const { seccion, campo, assetId } of asignaciones) {
    const actual = (contenido[seccion] ?? {}) as Record<string, unknown>;
    contenido[seccion] = { ...actual, [campo]: assetId };
    console.log(`✓ borrador: ${seccion}.${campo} → ${assetId}`);
  }

  const { error: errorEscritura } = await supabase
    .from('site_content_drafts')
    .update({
      content_json: contenido as Json,
      revision: borrador.revision + 1,
    })
    .eq('site_id', sitio.siteId);

  if (errorEscritura) fallar(`No se pudo actualizar el borrador: ${errorEscritura.message}`);
}

/**
 * Ancho y alto leídos de la cabecera del archivo.
 *
 * Se hace a mano en vez de añadir una dependencia de imagen: son tres formatos
 * y solo se necesitan dos enteros. Devuelve `null` si el formato no se
 * reconoce; `assets.width/height` son opcionales precisamente por esto.
 */
function dimensiones(
  buffer: Buffer,
  mime: string,
): { width: number | null; height: number | null } {
  try {
    if (mime === 'image/png' && buffer.length > 24) {
      return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
    }

    if (mime === 'image/webp' && buffer.toString('ascii', 12, 16) === 'VP8X') {
      // VP8X guarda las medidas menos uno, en 24 bits little-endian.
      return {
        width: buffer.readUIntLE(24, 3) + 1,
        height: buffer.readUIntLE(27, 3) + 1,
      };
    }

    if (mime === 'image/webp' && buffer.toString('ascii', 12, 16) === 'VP8 ') {
      return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }

    if (mime === 'image/webp' && buffer.toString('ascii', 12, 16) === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }

    if (mime === 'image/jpeg') {
      let offset = 2;
      while (offset < buffer.length - 9) {
        if (buffer[offset] !== 0xff) break;
        const marcador = buffer[offset + 1] ?? 0;
        // SOF0..SOF15, saltando los marcadores que no describen el cuadro.
        if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
          return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
        }
        offset += 2 + buffer.readUInt16BE(offset + 2);
      }
    }
  } catch {
    // Un archivo truncado o con cabecera inesperada no debe frenar la carga:
    // las dimensiones son informativas, el archivo es lo que importa.
  }

  return { width: null, height: null };
}

function argumentos(): string[] {
  const args = process.argv.slice(2);
  return args[0] === '--' ? args.slice(1) : args;
}

function fallar(mensaje: string): never {
  console.error(`\nERROR: ${mensaje}`);
  process.exit(1);
}
