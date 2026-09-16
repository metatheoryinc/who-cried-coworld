import { expect,it } from 'vitest';
import { rankBids,wolfSchedule } from '../../src/game/domain/floor.js';
import type { Bid } from '../../src/shared/actions.js';
const bid=(slot:number,patch:Partial<Bid>={})=>({slot,bid:{kind:'bid' as const,wantsToSpeak:true,urgency:0,text:`Speech ${slot}`,replyTo:null,accusation:null,reason:'',...patch}});
const context=()=>({day:1,window:0,living:[0,1,2,3,4,5,6,7,8],counts:{} as Record<number,number>,recent:{} as Record<number,string[]>,lastSpeechId:null as string|null});
it('ranks speech count before direct reply before urgency',()=>{
 const c=context();c.counts[5]=1;c.lastSpeechId='public_2';
 expect(rankBids([bid(5,{urgency:3,replyTo:'public_2'}),bid(4)],c)).toEqual([4,5]);
 c.counts[5]=0;
 expect(rankBids([bid(4,{urgency:3}),bid(5,{replyTo:'public_2'})],c)).toEqual([5,4]);
});
it('uses rotating slot priority independently of completion order',()=>{
 const c=context(),rows=[bid(0),bid(1),bid(2)];
 expect(rankBids(rows,c)).toEqual([0,1,2]);c.window=1;
 expect(rankBids([...rows].reverse(),c)).toEqual([1,2,0]);
});
it('excludes dead, passing, capped, and own-repeat bids',()=>{
 const c=context();c.living=[1,2,3,4];c.counts[1]=2;c.recent[2]=[' Hello '];
 expect(rankBids([bid(0),bid(1),bid(2,{text:'hello'}),bid(3,{wantsToSpeak:false,text:''}),bid(4)],c)).toEqual([4]);
});
it('limits Wolf turns without shrinking the four-window schedule',()=>{
 expect(wolfSchedule([5,1])).toEqual([1,5,1,5]);expect(wolfSchedule([1])).toEqual([1,1,null,null]);expect(wolfSchedule([])).toEqual([null,null,null,null]);
});
