import type { FieldDef } from '@nitro-web/contracts';
import { codificarNombre } from '@/lib/formulario';

export type OpcionAsset = { id: string; etiqueta: string; slot: string | null };

/**
 * Un campo del editor, dibujado según lo que declara el schema.
 *
 * Los campos `image` son el caso interesante: no se escribe una URL, se elige
 * un asset ya subido. El contenido guarda `assets.id` (ADR 0003), así que el
 * desplegable ofrece exactamente los assets del sitio, filtrados por el slot
 * que el campo declara — ofrecer un logo donde va la foto de producto sería
 * ofrecer un error.
 */
export function CampoEditor({
  campo,
  ruta,
  valor,
  assets,
  soloLectura,
}: {
  campo: FieldDef;
  ruta: (string | number)[];
  valor: unknown;
  assets: OpcionAsset[];
  soloLectura: boolean;
}) {
  const nombre = codificarNombre(...ruta);
  const id = nombre.replace(/\./g, '-');

  return (
    <div>
      <label className="etiqueta" htmlFor={id}>
        {campo.label}
        {campo.required && <span className="ml-1 text-red-600">*</span>}
      </label>

      <Control
        campo={campo}
        id={id}
        nombre={nombre}
        valor={valor}
        assets={assets}
        soloLectura={soloLectura}
      />

      {campo.help && <p className="ayuda">{campo.help}</p>}
    </div>
  );
}

function Control({
  campo,
  id,
  nombre,
  valor,
  assets,
  soloLectura,
}: {
  campo: FieldDef;
  id: string;
  nombre: string;
  valor: unknown;
  assets: OpcionAsset[];
  soloLectura: boolean;
}) {
  const comun = { id, name: nombre, disabled: soloLectura, className: 'campo mt-1' };
  const texto = typeof valor === 'string' ? valor : '';

  switch (campo.type) {
    case 'textarea':
      return (
        <textarea
          {...comun}
          rows={3}
          maxLength={campo.maxLength}
          defaultValue={texto}
        />
      );

    case 'boolean':
      return (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            id={id}
            name={nombre}
            type="checkbox"
            disabled={soloLectura}
            defaultChecked={valor === true}
            className="h-4 w-4 rounded border-ink-300"
          />
          <span className="text-ink-600">Activado</span>
        </label>
      );

    case 'number':
    case 'money':
      return (
        <input
          {...comun}
          type="number"
          min={campo.min}
          max={campo.max}
          // Los montos son enteros en la unidad mínima de la moneda: nunca
          // decimales. Un `step` fraccionario invitaría a escribir 4900.50.
          step={campo.type === 'money' ? 1 : 'any'}
          defaultValue={typeof valor === 'number' ? valor : ''}
        />
      );

    case 'select':
      return (
        <select {...comun} defaultValue={texto}>
          <option value="">—</option>
          {(campo.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );

    case 'image': {
      const compatibles = assets.filter((a) => !campo.assetSlot || a.slot === campo.assetSlot);
      return (
        <>
          <select {...comun} defaultValue={texto}>
            <option value="">Sin imagen</option>
            {compatibles.map((a) => (
              <option key={a.id} value={a.id}>
                {a.etiqueta}
              </option>
            ))}
          </select>
          {compatibles.length === 0 && (
            <p className="ayuda">
              No hay imágenes subidas para el espacio <code>{campo.assetSlot}</code>. Súbelas en la
              pestaña de imágenes.
            </p>
          )}
        </>
      );
    }

    case 'url':
      return <input {...comun} type="url" defaultValue={texto} />;

    default:
      return <input {...comun} type="text" maxLength={campo.maxLength} defaultValue={texto} />;
  }
}
