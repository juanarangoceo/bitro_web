import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  hasPendingChanges,
  publishSiteAsSupport,
  rollbackSiteAsSupport,
} from '../publication';

describe('hasPendingChanges', () => {
  it('no hay pendientes si el borrador nunca se tocó', () => {
    expect(hasPendingChanges({ draftUpdatedAt: null, publishedAt: null })).toBe(false);
  });

  it('hay pendientes si se editó y nunca se publicó', () => {
    expect(
      hasPendingChanges({ draftUpdatedAt: '2026-07-28T10:00:00Z', publishedAt: null }),
    ).toBe(true);
  });

  it('hay pendientes si el borrador es posterior a la publicación', () => {
    expect(
      hasPendingChanges({
        draftUpdatedAt: '2026-07-28T12:00:00Z',
        publishedAt: '2026-07-28T10:00:00Z',
      }),
    ).toBe(true);
  });

  it('no hay pendientes justo después de publicar', () => {
    expect(
      hasPendingChanges({
        draftUpdatedAt: '2026-07-28T10:00:00Z',
        publishedAt: '2026-07-28T12:00:00Z',
      }),
    ).toBe(false);
  });
});

describe('operaciones de soporte', () => {
  it('rechaza publicar si el actor no es administrador activo', async () => {
    const client = clienteSinOperador();
    await expect(
      publishSiteAsSupport(client, 'site-1', {
        actorUserId: 'user-1',
        reviewedBy: 'Revisor',
        reason: 'Primera publicación revisada',
      }),
    ).resolves.toMatchObject({ ok: false, code: 'not_found' });
  });

  it('rechaza rollback si el actor no es administrador activo', async () => {
    const client = clienteSinOperador();
    await expect(
      rollbackSiteAsSupport(client, 'site-1', 'publication-1', {
        actorUserId: 'user-1',
        reason: 'Restaurar contenido estable',
      }),
    ).resolves.toEqual({ ok: false, error: 'Operador de plataforma no autorizado' });
  });
});

function clienteSinOperador(): SupabaseClient {
  const maybeSingle = async () => ({ data: null, error: null });
  const eqActivo = () => ({ maybeSingle });
  const eqUsuario = () => ({ eq: eqActivo });
  const select = () => ({ eq: eqUsuario });
  return { from: () => ({ select }) } as unknown as SupabaseClient;
}
