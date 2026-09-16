import { expect, it } from 'vitest';
import { z } from 'zod';
import { Slot, GameText } from '../../src/shared/primitives.js';
it('accepts only integer seats zero through eight', () => {
  expect(Slot.parse(8)).toBe(8);
  for (const v of [-1,9,1.5,'1',NaN,Infinity]) expect(Slot.safeParse(v).success).toBe(false);
});
it('bounds text by Unicode code points and rejects control characters', () => {
  expect(GameText(480).parse('🐺'.repeat(480))).toHaveLength(960);
  for (const v of ['🐺'.repeat(481),'x\u0000','x\t','x\u007f']) expect(GameText(480).safeParse(v).success).toBe(false);
  expect(GameText(480).parse('hello\nworld')).toBe('hello\nworld');
});
it('exports strict bounded schemas for Coworld', () => {
  const schema=z.toJSONSchema(z.object({tokens:z.array(z.string()).length(9)}).strict());
  expect(schema.additionalProperties).toBe(false);
  expect(schema.required).toEqual(['tokens']);
});
