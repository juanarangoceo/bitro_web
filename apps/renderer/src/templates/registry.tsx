import type { ReactElement } from 'react';
import type { ResolvedSite } from '@nitro-web/db';
import { CoffeeMakerV1 } from './coffee-maker/CoffeeMakerV1';

/**
 * Registro de componentes de plantilla.
 *
 * La base de datos guarda un `component_key` y aquí se traduce a un componente
 * React. El mapa es **estático a propósito**: un `import()` construido con un
 * string que viene de la base convertiría una fila de datos en una ruta de carga
 * de código.
 *
 * Registrar una plantilla nueva es añadir una entrada aquí y su clave en
 * `REGISTERED_COMPONENT_KEYS` de `@nitro-web/templates`, que es lo que valida el
 * admin antes de publicar.
 */

export interface TemplateProps {
  site: ResolvedSite;
  isPreview?: boolean;
}

const COMPONENTS: Record<string, (props: TemplateProps) => ReactElement> = {
  coffeeMakerV1: CoffeeMakerV1,
  coffeeMakerV11: CoffeeMakerV1,
};

/**
 * Dibuja la landing con el componente que corresponda.
 *
 * Un `component_key` desconocido no debería llegar hasta aquí: se valida al
 * publicar (runbook R4). Si llega, se muestra un aviso neutro en lugar de una
 * excepción — el visitante no tiene por qué ver un error de nuestro sistema, y
 * un 500 en una campaña pagada cuesta dinero.
 */
export function renderTemplate(site: ResolvedSite, options: { isPreview?: boolean } = {}) {
  const Component = COMPONENTS[site.componentKey];

  if (!Component) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-coffee-50 px-6">
        <p className="text-coffee-600">Esta página no está disponible en este momento.</p>
      </main>
    );
  }

  return <Component site={site} isPreview={options.isPreview} />;
}
