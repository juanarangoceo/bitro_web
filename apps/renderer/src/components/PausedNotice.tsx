/**
 * Respuesta para una landing pausada (§4.5).
 *
 * Se muestra algo controlado y neutro en lugar de un 404 o, peor, la landing de
 * otro cliente. No se menciona a Nitro Web: el visitante llegó al dominio del
 * cliente, y explicarle que la plataforma pausó la cuenta expone la relación
 * comercial del cliente ante sus propios compradores.
 */
export function PausedNotice() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-coffee-50 px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl font-bold text-coffee-900">
          Esta página no está disponible en este momento
        </h1>
        <p className="mt-4 text-coffee-600">
          Vuelve a intentarlo más tarde.
        </p>
      </div>
    </main>
  );
}
