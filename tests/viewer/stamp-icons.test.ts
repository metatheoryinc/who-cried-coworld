import {expect,it} from 'vitest';
import {scatter,stampArt} from '../../src/viewer/stamp-icons.js';
it('places a stamp at a stable, bounded spot and angle per key',()=>{
 expect(scatter('vote:3:1')).toEqual(scatter('vote:3:1'));
 expect(scatter('vote:3:1')).not.toEqual(scatter('vote:3:2'));
 for(const key of ['a','kill:4:1','vote:0:8','knife:5:5','skip:2:2']){const {x,y,r}=scatter(key);expect(x).toBeGreaterThanOrEqual(12);expect(x).toBeLessThanOrEqual(58);expect(y).toBeGreaterThanOrEqual(8);expect(y).toBeLessThanOrEqual(46);expect(Math.abs(r)).toBeLessThanOrEqual(35);}
});
it('uses painted art for every stamp, including the knife',()=>{
 expect(stampArt('vote')).toBe('vote_banner_town_hoof');
 expect(stampArt('kill')).toBe('vote_banner_wolfs_claw');
 expect(stampArt('protect')).toBe('guard_icon');
 expect(stampArt('skip')).toBe('abstain_town');
 expect(stampArt('knife')).toBe('knife_icon');
});
