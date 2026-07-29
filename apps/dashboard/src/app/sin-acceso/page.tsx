/**
 * Cuenta autenticada pero sin tenant.
 *
 * Ocurre cuando el usuario existe en Auth pero nadie completó su membresía
 * (R3, pasos 2 y 3). Mostrar un dashboard vacío haría pensar que el producto
 * está roto; decirlo permite pedir ayuda con la palabra correcta.
 */
export default function SinAccesoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="tarjeta max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">Tu cuenta aún no tiene empresa asignada</h1>
        <p className="mt-2 text-sm text-ink-600">
          El acceso funcionó, pero tu usuario no pertenece todavía a ninguna empresa. Escríbenos
          para que terminemos de configurarla.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button type="submit" className="boton-secundario">
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
