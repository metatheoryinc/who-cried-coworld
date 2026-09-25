import {it,expect} from 'vitest';
import {assignDisplayNames,modelDisplayName} from '../../src/shared/player-names.js';
it('numbers duplicates by seat order and reserves unregistered human names',()=>{
 const original=['Human','policy a','policy b','policy c'];
 expect(assignDisplayNames(original,new Map([[3,'Sonnet'],[2,'Gemini'],[1,'Sonnet']]))).toEqual(['Human','Sonnet','Gemini','Sonnet B']);
 expect(assignDisplayNames(['Sonnet','p','p'],new Map([[2,'Sonnet'],[1,'Sonnet']]))).toEqual(['Sonnet','Sonnet B','Sonnet C']);
 expect(assignDisplayNames(['p','p','p'],new Map([[0,'Sonnet'],[1,'Sonnet B'],[2,'Sonnet']]))).toEqual(['Sonnet','Sonnet B','Sonnet C']);
 // Duplicates use letters, never digits, so a name cannot be read as a seat number; long names stay within 32 characters.
 const long='A'.repeat(32);expect(assignDisplayNames(['p','p'],new Map([[0,long],[1,long]]))[1]).toBe('A'.repeat(30)+' B');
});
it('provides readable names from known models and validates overrides',()=>{
 expect(modelDisplayName('us.anthropic.claude-haiku-4-5-20251001-v1:0')).toBe('Haiku');
 expect(modelDisplayName('anthropic/claude-sonnet-4')).toBe('Sonnet');
 expect(modelDisplayName('google/gemini-flash')).toBe('Gemini');
 expect(modelDisplayName('unknown')).toBeUndefined();
 expect(modelDisplayName('unknown','Alice')).toBe('Alice');
 expect(()=>modelDisplayName('unknown','<script>')).toThrow();
});

import {HumanSession} from '../../src/game/runtime/human-session.js';
import {GameConfig} from '../../src/shared/config.js';
it('locks registrations at start, preserves human identity and records original policy',()=>{
 const config=GameConfig.parse({mode:'human',tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:i===0?'Sonnet':`policy-${i}`}))});
 const s=new HumanSession(config,'names');s.registerHuman(0);
 s.registerName(0,'Impostor');s.registerName(2,'Sonnet');s.registerName(1,'Sonnet');s.registerName(1,'Changed');s.registerName(3,'<invalid>');s.start(0);
 expect(s.config.players.slice(0,4).map(p=>p.name)).toEqual(['Sonnet','Sonnet B','Sonnet C','policy-3']);
 s.registerName(1,'Reconnect');expect(s.config.players[1]!.name).toBe('Sonnet B');
 const started=s.journal.find(e=>e.payload.kind==='started')!;
 expect(started.payload.kind==='started'&&started.payload.roster[1]).toMatchObject({name:'Sonnet B',policyName:'policy-1'});
});
it('does not count a longer duplicate name as mentioning the shorter one',async()=>{
 const {mentionsName}=await import('../../src/shared/player-names.js');
 const names=['Jt','Haiku','Haiku B','Haiku C'];
 expect(mentionsName('Haiku B, what is your read?','Haiku',names)).toBe(false);
 expect(mentionsName('Haiku B, what is your read?','Haiku B',names)).toBe(true);
 expect(mentionsName('Haiku and Haiku B both dodged','Haiku',names)).toBe(true);
 expect(mentionsName('ask Haiku a question','Haiku',names)).toBe(true);
});
