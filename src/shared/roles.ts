import { z } from 'zod';
export const Role=z.enum(['wolf','alchemist','track_reader','seer','guard','chef','dairy_maid','priest','noble','sheep','jester']);
export type Role=z.infer<typeof Role>;
export const Faction=z.enum(['wolf','town','solo']);
export type Faction=z.infer<typeof Faction>;
export const factionOf=(role:Role):Faction=>['wolf','alchemist','track_reader'].includes(role)?'wolf':role==='jester'?'solo':'town';
export const defaultRoles:Role[]=['wolf','alchemist','seer','guard','sheep','sheep','sheep','sheep','sheep'];
export const RoleDeck=z.array(Role).length(9).refine(roles=>{
 const wolves=roles.filter(r=>factionOf(r)==='wolf').length,nobles=roles.filter(r=>r==='noble').length;
 return wolves>=1&&wolves<=3&&nobles!==1&&nobles<=3&&roles.filter(r=>r==='jester').length<=1;
},'Use 1–3 wolves, zero or 2–3 Nobles, and at most one Trickster');
export const roleNames:Record<Role,string>={wolf:'Wolf',alchemist:'Alchemist',track_reader:'Track Reader',seer:'Seer',guard:'Guard',chef:'Chef',dairy_maid:'Dairy Maid',priest:'Priest',noble:'Noble',sheep:'Sheep',jester:'Trickster'};
export const NewD3Setup=z.enum(['A1','A2','A3','B1','B2','B3','C1','C2','C3']);
export const newD3Decks:Record<z.infer<typeof NewD3Setup>,Role[]>={
 A1:['wolf','alchemist','seer','guard',...Array<Role>(5).fill('sheep')],
 A2:['wolf','alchemist','chef','priest',...Array<Role>(5).fill('sheep')],
 A3:['wolf','alchemist','noble','noble',...Array<Role>(5).fill('sheep')],
 B1:['wolf','track_reader','priest','dairy_maid',...Array<Role>(5).fill('sheep')],
 B2:['wolf','track_reader','chef','dairy_maid',...Array<Role>(5).fill('sheep')],
 B3:['wolf','track_reader','priest','guard',...Array<Role>(5).fill('sheep')],
 C1:['wolf','wolf','seer',...Array<Role>(6).fill('sheep')],
 C2:['wolf','wolf','chef',...Array<Role>(6).fill('sheep')],
 C3:['wolf','wolf','noble','noble',...Array<Role>(5).fill('sheep')],
};
