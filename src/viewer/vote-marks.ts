import type { ActionBody } from '../shared/actions.js';
import type { Payload } from '../shared/events.js';
/** Only use the local accepted vote or a publicly revealed ballot batch. */
export function voteMarks(state:{day:number;phase:string;accepted:ActionBody|null;events:{day:number;payload:Payload}[]}|null,target:number){
 if(!state)return {count:0,majority:0,own:false};
 if(state.phase==='vote')return {count:state.accepted?.kind==='vote'&&state.accepted.target===target?1:0,majority:0,own:true};
 return {count:0,majority:0,own:false};
}
