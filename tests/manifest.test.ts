import {expect,it} from 'vitest';
import manifest from '../coworld_manifest_template.json';
import {GameConfig} from '../src/shared/config.js';
it('keeps published variants and certification valid after runner token injection',()=>{
 const tokens=Array.from({length:9},(_,i)=>`token-${i}`);
 for(const config of [...manifest.variants.map(v=>v.game_config),manifest.certification.game_config]){
  expect(config).not.toHaveProperty('tokens');expect(()=>GameConfig.parse({...config,tokens})).not.toThrow();
 }
 expect(manifest.game.config_schema.required).toContain('tokens');
 expect(manifest.game.config_schema.properties.tokens).toMatchObject({type:'array',minItems:9,maxItems:9});
 expect(manifest.variants.find(v=>v.id==='standard')?.game_config).toMatchObject({mode:'bots',setup:'random'});
 expect(manifest.variants.find(v=>v.id==='standard')?.game_config).not.toHaveProperty('seed');
 expect(new Set(manifest.certification.players.map(p=>p.player_id))).toEqual(new Set(manifest.player.map(p=>p.id)));
 expect(manifest.game).not.toHaveProperty('version');
});

it('publishes fast LLM play with fresh randomness and ten-second windows',()=>{
 const config=manifest.variants.find(v=>v.id==='fast-llm')?.game_config;
 expect(config).toMatchObject({mode:'fast',setup:'random',maxDays:8,windowMs:10000});
 expect(config).not.toHaveProperty('seed');
});
