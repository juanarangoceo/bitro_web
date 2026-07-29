import { describe, expect, it } from 'vitest';
import { hasPendingChanges } from '../publication';

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
