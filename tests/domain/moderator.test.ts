import {expect,it} from 'vitest';
import {validateModeratorChoice,type ModeratorInput} from '../../src/game/domain/moderator.js';
const input:ModeratorInput={day:1,roster:[{slot:0,name:'Ann',alive:true},{slot:1,name:'Bo',alive:true},{slot:2,name:'Cy',alive:true}],counts:{},eligibleSlots:[1,2],recent:[],humanMessage:null,transcript:[]};
it('accepts only eligible living speakers',()=>{
 expect(validateModeratorChoice({slot:1,prompt:'Bo, anything to add?'},input).slot).toBe(1);
 expect(()=>validateModeratorChoice({slot:0,prompt:'Ann, anything to add?'},input)).toThrow();
});
it('rejects a third consecutive turn only when another speaker is eligible',()=>{
 expect(()=>validateModeratorChoice({slot:1,prompt:'Bo, go on.'},{...input,recent:[1,1]})).toThrow('three times');
 expect(validateModeratorChoice({slot:1,prompt:'Bo, go on.'},{...input,eligibleSlots:[1],recent:[1,1]}).slot).toBe(1);
});
