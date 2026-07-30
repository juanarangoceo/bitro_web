import Link from 'next/link';
import { createSecretClient } from '@nitro-web/db';
import { slugify } from '@nitro-web/shared';
import { redirect } from 'next/navigation';
import { Shell } from '@/components/Shell';
import { auditar, requerirOperador } from '@/lib/admin';

export default async function Clientes({ searchParams }: {
  searchParams: Promise<{ error?: string; creado?: string }>;
}) {
  const operador = await requerirOperador();
  const params = await searchParams;
  const db = createSecretClient();
  const [{ data: clientes }, { data: planes }] = await Promise.all([
    db.from('tenants').select('id, name, slug, status, billing_status, plan_id, created_at, sites ( id )').order('created_at', { ascending: false }),
    db.from('plans').select('id, display_name').eq('is_active', true).order('sort_order'),
  ]);

  async function crear(formData: FormData) {
    'use server';
    const actor = await requerirOperador();
    const nombre = String(formData.get('nombre') ?? '').trim();
    const slugEntrada = String(formData.get('slug') ?? '').trim();
    const slug = slugify(slugEntrada || nombre);
    const planId = String(formData.get('plan_id') ?? '');
    if (!nombre || !slug || !planId) redirect('/clientes?error=datos');
    const secreto = createSecretClient();
    const { data, error } = await secreto.from('tenants').insert({
      name: nombre, slug, plan_id: planId, status: 'active', billing_status: 'trial',
    }).select('id').single();
    if (error || !data) redirect(`/clientes?error=${error?.code === '23505' ? 'slug' : 'crear'}`);
    await auditar({ operador: actor, accion: 'tenant.created', tenantId: data.id, entidad: 'tenant', entidadId: data.id, payload: { name: nombre, slug, plan_id: planId } });
    redirect(`/clientes/${data.id}?creado=1`);
  }

  return <Shell operador={operador} titulo="Clientes">
    {params.error && <Aviso texto="No se pudo crear el cliente. Revisa los datos y que el slug no esté ocupado." />}
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {(clientes ?? []).map((cliente) => <Link href={`/clientes/${cliente.id}`} key={cliente.id} className="tarjeta block p-4 hover:border-brand-500">
          <div className="flex justify-between gap-4"><div><p className="font-medium">{cliente.name}</p><p className="text-xs text-ink-500">{cliente.slug} · {cliente.plan_id}</p></div>
            <div className="text-right text-xs"><p>{cliente.status}</p><p className="text-ink-500">{cliente.sites?.length ?? 0} sitios</p></div></div>
        </Link>)}
      </div>
      <form action={crear} className="tarjeta h-fit space-y-4 p-5">
        <h2 className="font-medium">Vincular cliente</h2>
        <Campo id="nombre" etiqueta="Empresa" required />
        <Campo id="slug" etiqueta="Slug interno" ayuda="Opcional; se genera desde el nombre." />
        <div><label className="etiqueta" htmlFor="plan_id">Plan</label><select className="campo mt-1" id="plan_id" name="plan_id" required>
          {(planes ?? []).map((plan) => <option key={plan.id} value={plan.id}>{plan.display_name}</option>)}
        </select></div>
        <button className="boton-primario w-full">Crear cliente</button>
      </form>
    </div>
  </Shell>;
}

function Campo({ id, etiqueta, ayuda, required }: { id: string; etiqueta: string; ayuda?: string; required?: boolean }) {
  return <div><label className="etiqueta" htmlFor={id}>{etiqueta}</label><input className="campo mt-1" id={id} name={id} required={required} />{ayuda && <p className="ayuda">{ayuda}</p>}</div>;
}
function Aviso({ texto }: { texto: string }) { return <p className="mb-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{texto}</p>; }

