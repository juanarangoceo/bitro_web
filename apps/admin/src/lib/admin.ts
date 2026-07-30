import { createSecretClient, type Json } from '@nitro-web/db';
import { redirect } from 'next/navigation';
import { supabaseSesion } from './supabase';

export type Operador = { userId: string; email: string; nombre: string };

export async function requerirOperador(): Promise<Operador> {
  const sesion = await supabaseSesion();
  const { data: { user } } = await sesion.auth.getUser();
  if (!user) redirect('/login');

  const secreto = createSecretClient();
  const { data: operador } = await secreto
    .from('platform_admins')
    .select('display_name, is_active')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!operador?.is_active) redirect('/sin-acceso');
  return {
    userId: user.id,
    email: user.email ?? '',
    nombre: operador.display_name?.trim() || user.email || 'Operador',
  };
}

export async function auditar(input: {
  operador: Operador;
  accion: string;
  tenantId?: string;
  entidad?: string;
  entidadId?: string;
  payload?: Json;
}) {
  const secreto = createSecretClient();
  const { error } = await secreto.from('audit_log').insert({
    actor_user_id: input.operador.userId,
    tenant_id: input.tenantId,
    is_support_mode: Boolean(input.tenantId),
    support_reason: input.tenantId ? 'Operación desde el admin maestro' : null,
    action: input.accion,
    entity_type: input.entidad,
    entity_id: input.entidadId,
    payload_json: input.payload ?? {},
  });
  if (error) throw new Error(`No se pudo registrar auditoría: ${error.message}`);
}

