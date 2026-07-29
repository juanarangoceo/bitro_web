import { describe, expect, it } from 'vitest';
import { estimarCostoMicros } from './index';
describe('estimarCostoMicros', () => {
  it('conserva microdólares enteros', () => expect(estimarCostoMicros('gemini-3.6-flash', 1000, 500)).toBe(5250));
  it('no inventa tarifas', () => expect(estimarCostoMicros('otro', 1000, 500)).toBeNull());
});
