import {expect,it} from 'vitest';
import {playerConnection} from '../../src/viewer/connection.js';
it('keeps local seat credentials on the human socket',()=>{
 expect(playerConnection('http://localhost:8772/client/player?slot=0&token=test')).toMatchObject({socket:'ws://localhost:8772/human?slot=0&token=test',replay:'http://localhost:8772/replay.json'});
});
it('uses the supplied hosted address unchanged, without requiring browser tokens',()=>{
 const address='wss://softmax.com/api/episodes/e/proxy/player?auth=abc%2Bdef';
 const c=playerConnection('https://softmax.com/api/episodes/e/proxy/client/player?address='+encodeURIComponent(address));
 expect(c.socket).toBe(address);
 expect(c.replay).toBe('https://softmax.com/api/episodes/e/proxy/replay.json');
 expect(c.replayPage).toBe('https://softmax.com/observatory/v2');
});
it('converts http addresses and strips fragments without copying page credentials',()=>{
 expect(playerConnection('https://example.com/client/player?slot=8&token=private&address='+encodeURIComponent('https://example.com/proxy/player?ticket=x#ignored')).socket).toBe('wss://example.com/proxy/player?ticket=x');
});
it.each(['javascript:alert(1)','file:///tmp/player','ftp://example.com/player'])('rejects invalid supplied socket protocol %s',address=>{
 expect(()=>playerConnection('https://example.com/client/player?address='+encodeURIComponent(address))).toThrow();
});

import {viewerConnection} from '../../src/viewer/connection.js';
it('connects hosted spectators to the exact supplied proxy socket',()=>{
 const address='wss://softmax.com/api/episode/e/proxy/global?ticket=abc%2Bdef';
 expect(viewerConnection('https://softmax.com/api/episode/e/proxy/client/global?address='+encodeURIComponent(address))).toEqual({socket:address,isSeatInspector:false});
});
it('preserves nested paths for local viewer and inspector fallbacks',()=>{
 expect(viewerConnection('https://example.com/nested/client/global?cursor=4').socket).toBe('wss://example.com/nested/global');
 expect(viewerConnection('http://localhost:8772/client/player?slot=3&token=test&cursor=4')).toEqual({socket:'ws://localhost:8772/inspect?slot=3&token=test',isSeatInspector:true});
 expect(viewerConnection('https://example.com/nested/client/player?slot=3&token=test').isSeatInspector).toBe(true);
 expect(viewerConnection('http://localhost:8772/').socket).toBe('ws://localhost:8772/global');
});
it('validates supplied viewer addresses and converts HTTPS to WSS',()=>{
 expect(viewerConnection('https://example.com/client/global?address='+encodeURIComponent('https://proxy.example/global?ticket=x#ignored')).socket).toBe('wss://proxy.example/global?ticket=x');
 expect(()=>viewerConnection('https://example.com/client/global?address=javascript:alert(1)')).toThrow();
});
it('sends hosted players to Softmax without leaking seat credentials',()=>{
 const address='wss://softmax.com/api/session/proxy/player?token=private';
 const c=playerConnection('https://softmax.com/api/session/proxy/client/player?slot=0&token=private&address='+encodeURIComponent(address));
 expect(c.replayPage).toBe('https://softmax.com/observatory/v2');
 expect(c.replayLabel).toBe('Open Softmax');
 expect(c.replayNotice).toContain('completed game');
 expect(c.replayPage).not.toContain('private');
});
it('recognizes a Softmax socket when the player page uses a separate asset host',()=>{
 const c=playerConnection('https://assets.example/client/player?address='+encodeURIComponent('wss://softmax.com/api/proxy/player?ticket=test'));
 expect(c.replayPage).toBe('https://softmax.com/observatory/v2');
});
it('retains direct replay links for local games and avoids lookalike domains',()=>{
 const c=playerConnection('http://localhost:8772/client/player?slot=0&token=test');
 expect(c.replayPage).toBe('http://localhost:8772/client/replay?replay=http%3A%2F%2Flocalhost%3A8772%2Freplay.json');
 expect(c.replayLabel).toBe('Watch replay');
 expect(playerConnection('https://softmax.com.example/client/player?slot=0&token=test').replayLabel).toBe('Watch replay');
});
it('recognizes the Observatory research proxy at game end',()=>{
 const c=playerConnection('https://api.observatory.softmax-research.net/v2/coworlds/jobs/job/proxy/client/player?slot=0&token=private');
 expect(c.replayLabel).toBe('Open Softmax');
 expect(c.replayPage).toBe('https://softmax.com/observatory/v2');
 expect(c.replayNotice).not.toContain('local host');
 expect(playerConnection('https://softmax-research.net.example/client/player').replayLabel).toBe('Watch replay');
});
