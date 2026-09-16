import {expect,it} from 'vitest';
import {foldPhaseBanners} from '../../src/viewer/phase-banners.js';
import type {Payload} from '../../src/shared/events.js';
const phase=(day:number,p:'day'|'night',durationMs:number)=>({day,payload:{kind:'phase',day,phase:p,durationMs} as Payload});
it('folds transition and phase start without changing source events or losing duration',()=>{
 const events=[phase(2,'day',5000),phase(2,'day',150000)];
 const folded=foldPhaseBanners(events);
 expect(folded).toHaveLength(1);expect(folded[0]!.payload).toMatchObject({durationMs:155000});
 expect(events[0]!.payload).toMatchObject({durationMs:5000});
});
it('preserves private chat, separate days and legacy single phase banners',()=>{
 const chat={day:1,payload:{kind:'wolf_chat',slot:1,text:'Plan'} as Payload};
 const folded=foldPhaseBanners([phase(1,'night',5000),phase(1,'night',75000),chat,phase(2,'day',150000),phase(2,'night',75000)]);
 expect(folded).toHaveLength(4);expect(folded[1]).toBe(chat);
 expect(folded[0]!.payload).toMatchObject({durationMs:80000});
});
