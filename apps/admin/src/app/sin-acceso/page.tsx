export default function SinAcceso() {
  return <main className="mx-auto max-w-lg px-4 py-20"><div className="tarjeta p-6">
    <h1 className="text-xl font-semibold">Sin acceso operativo</h1>
    <p className="mt-2 text-sm text-ink-600">Tu sesión es válida, pero tu usuario no figura como administrador activo de Nitro Web.</p>
    <form action="/auth/signout" method="post"><button className="boton-secundario mt-5">Cerrar sesión</button></form>
  </div></main>;
}
