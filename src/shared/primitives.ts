import { z } from 'zod';
export const Slot = z.number().int().min(0).max(8);
export type Slot = z.infer<typeof Slot>;
export const GameText = (max: number, min = 0) => z.string().refine(
  text => [...text].length >= min && [...text].length <= max && !/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/u.test(text),
  `Expected ${min}..${max} Unicode characters without tabs or control characters`,
);
export const Id = z.string().regex(/^[A-Za-z0-9_-]{1,80}$/);
export { Role, Faction } from './roles.js';
