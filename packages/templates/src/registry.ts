/**
 * Registro de plantillas.
 *
 * El renderer recibe de la base un `component_key` y necesita resolverlo a un
 * componente React. Ese registro es explícito y no dinámico a propósito: un
 * `import()` construido con un string de la base de datos convertiría el
 * contenido en una ruta de carga de código.
 *
 * Registrar una plantilla nueva es una línea aquí más su manifest.
 */

import type { TemplateManifest } from '@nitro-web/contracts';
import { coffeeMakerManifestV12 } from './coffee-maker/manifest-v1-2';

/** Manifests conocidos, indexados por `template_key`. */
export const TEMPLATE_MANIFESTS: Readonly<Record<string, TemplateManifest>> = {
  'coffee-maker': coffeeMakerManifestV12,
};

/** Claves de componente que el renderer sabe dibujar. */
export const REGISTERED_COMPONENT_KEYS: readonly string[] = [
  'coffeeMakerV1',
  'coffeeMakerV11',
  'coffeeMakerV12',
];

/**
 * ¿El renderer puede dibujar este `component_key`?
 *
 * Se comprueba **antes de publicar** (runbook R4). Descubrirlo al renderizar
 * significa una landing en blanco con tráfico pagado encima.
 */
export function isComponentRegistered(componentKey: string): boolean {
  return REGISTERED_COMPONENT_KEYS.includes(componentKey);
}

export function getManifest(templateKey: string): TemplateManifest | undefined {
  return TEMPLATE_MANIFESTS[templateKey];
}
