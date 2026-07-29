/**
 * 404 del renderer.
 *
 * Sin marca de Nitro Web ni enlaces: esta página aparece bajo dominios de
 * clientes, y un pie con nuestra marca en el 404 de un cliente es publicidad no
 * acordada. Además, no dar detalle sobre por qué falló evita que se pueda
 * sondear qué subdominios existen.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-coffee-50 px-6">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-2xl font-bold text-coffee-900">Página no encontrada</h1>
        <p className="mt-4 text-coffee-600">
          La dirección que buscas no existe o ya no está disponible.
        </p>
      </div>
    </main>
  );
}
