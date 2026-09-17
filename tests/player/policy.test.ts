import {expect,it,vi} from 'vitest';
import {llmAction} from '../../src/player/policy.js';
import {Session} from '../../src/game/runtime/session.js';
import {GameConfig} from '../../src/shared/config.js';
const observation=()=>{const s=new Session(GameConfig.parse({tokens:Array.from({length:9},(_,i)=>`t${i}`),players:Array.from({length:9},(_,i)=>({name:`P${i}`}))}),'test');s.start(0);return s.observation([...s.pending.keys()][0]!,0)!;};
it('uses the scripted baseline without credentials and never calls the provider',async()=>{
 const fetcher=vi.fn();const o=observation(),a=await llmAction(o,{model:'test',fetcher});
 expect(a.body.kind).toBe(o.request.kind);expect(a.report).toBeNull();expect(fetcher).not.toHaveBeenCalled();
});
it('uses the configured model, persona, structured output, and retries invalid content',async()=>{
 const o=observation();const logs:unknown[]=[];
 const fetcher=vi.fn().mockResolvedValueOnce(Response.json({choices:[{message:{content:'{}'}}]})).mockResolvedValueOnce(Response.json({choices:[{message:{content:JSON.stringify({kind:o.request.kind,text:'Ready.',summary:''})}}]}));
 const a=await llmAction(o,{model:'google/test',key:'secret',personality:'Speak briefly.',fetcher,onLog:r=>logs.push(r)});
 expect(a.report).toBeNull();expect(fetcher).toHaveBeenCalledTimes(2);
 const request=JSON.parse(fetcher.mock.calls[0]![1].body);
 expect(request.model).toBe('google/test');expect(request.messages[0].content).toContain('Speak briefly.');expect(request.response_format.type).toBe('json_schema');
 expect(JSON.stringify(logs)).not.toContain('secret');
});
it('uses Bedrock without an OpenRouter key instead of silently playing scripted',async()=>{
 const o=observation();const bedrockSender=vi.fn().mockResolvedValue({output:{message:{content:[{text:JSON.stringify({kind:o.request.kind,text:'Bedrock reply.',summary:''})}]}},stopReason:'end_turn'});
 const action=await llmAction(o,{provider:'bedrock',model:'bedrock-test',bedrockSender});
 expect(bedrockSender).toHaveBeenCalledTimes(1);expect(action.body).toMatchObject({text:'Bedrock reply.'});
});
it('sends the same explicit JSON-only system prompt through both providers and accepts a fenced Bedrock reply',async()=>{
 const o=observation();const body={kind:o.request.kind,text:'A precise reply.',summary:''};
 const fetcher=vi.fn().mockResolvedValue(Response.json({choices:[{message:{content:JSON.stringify(body)}}]}));
 const bedrockSender=vi.fn().mockResolvedValue({output:{message:{content:[{text:'```json\n'+JSON.stringify(body)+'\n```'}]}},stopReason:'end_turn'});
 await llmAction(o,{model:'test',key:'secret',personality:'Be concise.',fetcher});
 const action=await llmAction(o,{provider:'bedrock',model:'test',personality:'Be concise.',bedrockSender});
 const orPrompt=JSON.parse(fetcher.mock.calls[0]![1].body).messages[0].content;
 expect(bedrockSender.mock.calls[0]![0].input.system[0].text).toBe(orPrompt);
 expect(orPrompt).toContain('exactly one bare JSON object');
 expect(orPrompt).toContain('Do not wrap it in Markdown code fences');
 expect(action.body).toEqual(body);expect(action.report).toBeNull();expect(bedrockSender).toHaveBeenCalledTimes(1);
});
