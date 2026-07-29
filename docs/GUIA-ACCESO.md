# Guía de acceso a Nitro Web

## Qué panel existe hoy

El piloto tiene un **dashboard del cliente**. Es el panel donde el propietario de cada empresa crea y administra sus landings, imágenes, oferta, publicaciones, pedidos, métricas e IA.

El **administrador maestro de Nitro Web** descrito en la especificación pertenece a la v1 comercial (§2.2), no al piloto. Todavía no existe una interfaz maestra separada. Las altas iniciales se ejecutan con los runbooks internos y siempre quedan auditadas.

## Usuario propietario del piloto

- Correo: `juanarangopm@gmail.com`
- Empresa: `Coffee Maker Pro`
- Rol: `owner`
- Landing pública: https://nitro-web-renderer.vercel.app

La contraseña no se puede consultar: Supabase guarda solamente su hash. Tampoco debe escribirse en este repositorio.

## Entrar sin conocer la contraseña

1. Abre https://nitro-web-dashboard.vercel.app/login.
2. Escribe `juanarangopm@gmail.com`.
3. Pulsa **Recibe un enlace de acceso**.
4. Abre el correo y sigue el enlace. El enlace es temporal y de un solo uso.

Si el correo no llega, revisa spam. El envío de producción debe conectarse a un SMTP propio antes de incorporar clientes externos; el correo compartido de Supabase tiene límites bajos.

## Cambiar o crear contraseña

En Supabase: **Authentication → Users → juanarangopm@gmail.com → Send password recovery**. El usuario elige la contraseña desde el correo; ningún operador necesita conocerla.

Para una emergencia operativa también puede usarse la Admin API descrita en R3, pero la contraseña debe elegirla el propietario y nunca quedar en terminales, tickets o documentación.

## Recorrido inicial

1. En **Tus landings**, abre **Cafetera Espresso**.
2. **Ver preview** muestra el borrador y no cambia producción.
3. **Imágenes** administra los assets por espacio de plantilla.
4. **Oferta** define precio, envío e inventario; el precio nunca forma parte del copy.
5. **Asistente de contenido con IA** genera toda la landing o una sección. Revisa antes de publicar.
6. **Guardar cambios** guarda el borrador.
7. **Publicar cambios** crea un snapshot inmutable.
8. **Restaurar publicación anterior** hace rollback sin borrar historial.
9. **Pedidos** permite cambiar estados, abrir WhatsApp y exportar CSV.

## Qué no buscar en este piloto

No existen todavía el admin maestro, selector multiempresa, alta autoservicio de dominios propios ni billing automático. Son v1 comercial y solo se construyen después del gate de validación de §19.2.
