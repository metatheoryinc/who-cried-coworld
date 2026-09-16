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
