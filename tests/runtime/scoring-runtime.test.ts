import {expect,it} from 'vitest';
import {GameConfig} from '../../src/shared/config.js';
import {HumanSession} from '../../src/game/runtime/human-session.js';
import {ResultsV2} from '../../src/shared/results.js';
// Setup A2 with this seed: Wolf 1, Alchemist 5; seat 0 is a human Town player; bots never answer.
it('scores a finished game from the journal: read, hidden, columns, and a draw keeps bonuses',()=>{
 const s=new HumanSession(GameConfig.parse({mode:'human',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`Seat ${i}`})),setup:'A2',seed:'000102030405060708090a0b0c0d0e0f'}),'episode');
 s.registerHuman(0);s.start(0);s.advance(150000);
 const o=s.observation(0,150000)!;
 const perfect=[1,2,3,4,5,6,7,8].map(slot=>({slot,wolf:[1,5].includes(slot)?1:0}));
 expect(s.receive(0,JSON.stringify({protocol:'wcw.player/1',type:'action',episodeId:o.episodeId,requestId:o.requestId,observationId:o.observationId,body:{kind:'vote',target:null,summary:'',suspicion:perfect},report:null}),150001).status).toBe('accepted');
 s.advance(8*280000);
 const r=ResultsV2.parse(s.state.result);
 expect(r.outcome).toBe('draw');
 expect(r.metrics[0]).toMatchObject({win:0,read:0.125,survived:1,valid_actions:0.125});
 expect(r.scores[0]).toBeCloseTo(0.25*0.125,3);
 expect(r.metrics[1]).toMatchObject({win:0,hidden:0,valid_actions:0});expect(r.metrics[1]).not.toHaveProperty('read');
 expect(r.metrics[2]).toMatchObject({win:0,read:0,valid_actions:0});expect(r.metrics[2]).not.toHaveProperty('hidden');
 const finished=s.journal.find(e=>e.payload.kind==='finished')!.payload;
 expect(finished.kind==='finished'&&finished.result).toEqual(r);
});
