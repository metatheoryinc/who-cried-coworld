import { build } from 'esbuild';
await build({entryPoints:{'game':'src/game/main.ts','player':'src/player/main.ts','llm-player':'src/player/llm-main.ts'},bundle:true,platform:'node',target:'node24',format:'esm',outdir:'build',outExtension:{'.js':'.mjs'},packages:'external',sourcemap:true});
import { mkdir,copyFile,cp } from 'node:fs/promises';
await mkdir('build/viewer',{recursive:true});
await build({entryPoints:['src/viewer/branded.js'],bundle:true,platform:'browser',target:'es2022',format:'esm',outfile:'build/viewer/viewer.js'});
await build({entryPoints:['src/viewer/player.js'],bundle:true,platform:'browser',target:'es2022',format:'esm',outfile:'build/viewer/player.js'});
for(const file of ['index.html','style.css','player.html','player.css'])await copyFile(`src/viewer/${file}`,`build/viewer/${file}`);

await cp('src/viewer/assets','build/viewer/assets',{recursive:true});
