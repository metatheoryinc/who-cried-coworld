// All-bot games share the human-paced launcher, moderator, and provider adapter.
const destination=process.argv[2];
if(destination&&!destination.startsWith('--'))process.env.WCW_ARTIFACT_DIR=destination;
process.argv.push('--all-bots');
if(!process.argv.includes('--smoke'))process.argv.push('--llm');
await import('./human-play.mjs');
