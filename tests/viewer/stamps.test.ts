import {expect,it} from 'vitest';
import {traySlots,placementsFrom,place,clear,bodyFor,packStamps,stampsOn} from '../../src/viewer/stamps.js';
const vote={kind:'vote' as const,targets:[0,2,3],allowPass:true as const};
const night={kind:'night' as const,choices:[{ability:'kill' as const,targets:[2,3,4],actors:[1,5],allowPass:true as const},{ability:'block' as const,targets:[0,2,3,4,5],allowPass:true as const}]};
it('offers one stamp per decision, with a knife after the kill',()=>{
 expect(traySlots(vote)).toEqual([{id:'vote',targets:[0,2,3]}]);
 expect(traySlots(night)).toEqual([{id:'kill',targets:[2,3,4]},{id:'knife',targets:[1,5]},{id:'block',targets:[0,2,3,4,5]}]);
});
it('restores placements from the accepted draft',()=>{
 expect(placementsFrom(vote,{kind:'vote',target:3,summary:''})).toEqual({vote:3});
 expect(placementsFrom(night,{kind:'night',actions:[{ability:'kill',target:4,killer:5},{ability:'block',target:null}],summary:''})).toEqual({kill:4,knife:5,block:null});
 expect(placementsFrom(night,null)).toEqual({});
 expect(placementsFrom(vote,{kind:'night',actions:[],summary:''})).toEqual({});
});
it('places, moves, toggles off, and ignores illegal targets',()=>{
 let p=place({},night,'block',2,1);expect(p.block).toBe(2);
 p=place(p,night,'block',3,1);expect(p.block).toBe(3);
 p=place(p,night,'block',3,1);expect(p.block).toBeNull();
 expect(place(p,night,'kill',1,1)).toBe(p);
 expect(place(p,night,'knife',2,1)).toBe(p);
});
it('puts the knife on yourself when you first choose a kill target',()=>{
 const p=place({},night,'kill',4,1);expect(p).toEqual({kill:4,knife:1});
 expect(place({knife:5},night,'kill',4,1)).toEqual({knife:5,kill:4});
 expect(place({},night,'kill',4,9)).toEqual({kill:4});
});
it('clears a stamp and builds legal bodies',()=>{
 expect(clear({kill:4,knife:1},'kill')).toEqual({kill:null,knife:1});
 expect(bodyFor(vote,{})).toEqual({kind:'vote',target:null,summary:''});
 expect(bodyFor(vote,{vote:2})).toEqual({kind:'vote',target:2,summary:''});
 expect(bodyFor(night,{kill:4,knife:5,block:2})).toEqual({kind:'night',actions:[{ability:'kill',target:4,killer:5},{ability:'block',target:2}],summary:''});
 expect(bodyFor(night,{knife:5})).toEqual({kind:'night',actions:[{ability:'kill',target:null,killer:5},{ability:'block',target:null}],summary:''});
});
it('lists pack kill and knife stamps and own stamps per seat',()=>{
 expect(packStamps([{slot:5,actions:[{ability:'kill',target:3,killer:5},{ability:'block',target:2}]}])).toEqual([{id:'kill',slot:3,by:5},{id:'knife',slot:5,by:5}]);
 expect(stampsOn({kill:4,knife:1,block:4},4)).toEqual(['kill','block']);
});
