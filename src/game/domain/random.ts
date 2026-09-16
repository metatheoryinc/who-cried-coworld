import { createHash } from 'node:crypto';
import { RoleDeck,defaultRoles,type Role } from '../../shared/roles.js';
const seedPattern=/^[0-9a-f]{32}$/;
export function draw(seed:string,label:string,counter:number,n:number,word?:(input:string)=>number):{value:number;nextCounter:number} {
 if(!seedPattern.test(seed)||!Number.isSafeInteger(counter)||counter<0||!Number.isInteger(n)||n<1||n>2**32) throw new Error('Invalid random draw');
 const limit=Math.floor(2**32/n)*n;
 for(;;){
  const input=`${seed}:${label}:${counter++}`;
  const x=word?word(input):createHash('sha256').update(input).digest().readUInt32BE(0);
  if(!Number.isInteger(x)||x<0||x>=2**32) throw new Error('Invalid digest word');
  if(x<limit) return {value:x%n,nextCounter:counter};
 }
}
export function assignRoles(seed:string,deck:Role[]=defaultRoles):Role[] {
 const roles=RoleDeck.parse(deck);
 let counter=0;
 for(let i=roles.length-1;i>0;i--){
  const next=draw(seed,'roles',counter,i+1);
  counter=next.nextCounter;
  const current=roles[i]!;
  roles[i]=roles[next.value]!;
  roles[next.value]=current;
 }
 return roles;
}
