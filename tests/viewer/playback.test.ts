import {expect,it} from 'vitest';
import {nextReplayCursor} from '../../src/viewer/playback.js';

it('shows the final result for a tick before looping to the beginning',()=>{
  const cursors=[3,5,8];
  expect(nextReplayCursor(cursors,5,10,1,true)).toBe(10);
  expect(nextReplayCursor(cursors,10,10,1,true)).toBe(3);
  expect(nextReplayCursor(cursors,3,10,1,true)).toBe(5);
});
it('manual navigation clamps at the end and skips hidden events',()=>{
  expect(nextReplayCursor([3,5,8],10,10,1)).toBe(10);
  expect(nextReplayCursor([3,5,8],8,10,-1)).toBe(5);
  expect(nextReplayCursor([3,5,8],3,10,-1)).toBe(3);
});
it('handles empty and single-event replays',()=>{
  expect(nextReplayCursor([],0,0,1,true)).toBe(0);
  expect(nextReplayCursor([3],4,4,1,true)).toBe(3);
  expect(nextReplayCursor([3],3,4,1,true)).toBe(4);
});

it('never scrolls the host page while stepping or playing a replay', async () => {
 // Embedded on softmax.com, scrollIntoView also scrolled the parent page on every step.
 const { readFileSync } = await import('node:fs');
 const source = readFileSync(new URL('../../src/viewer/branded.js', import.meta.url), 'utf8');
 expect(source).not.toMatch(/\.scrollIntoView\(|window\.scroll(To|By)?\(|\bscrollTo\(/);
});

it('patches the floor instead of rebuilding it, so phase art does not flash on every step', async () => {
 const { readFileSync } = await import('node:fs');
 const source = readFileSync(new URL('../../src/viewer/branded.js', import.meta.url), 'utf8');
 expect(source).not.toMatch(/getElementById\('floor'\)\.innerHTML\s*=/);
 expect(source).toContain('patchFloor(');
});
