/** Keep the platform's proxy path and authorization query intact. */
function socketAddress(page:URL,path:string,seat:boolean){
 const address=page.searchParams.get('address');
 const socket=new URL(address||page.href,page);
 if(socket.protocol==='http:')socket.protocol='ws:';
 else if(socket.protocol==='https:')socket.protocol='wss:';
 if(!['ws:','wss:'].includes(socket.protocol))throw new Error('Invalid player connection address');
 if(!address){
  socket.pathname=/\/client\/(player|global|replay)\/?$/.test(page.pathname)?page.pathname.replace(/\/client\/(player|global|replay)\/?$/,path):new URL(path.slice(1),page).pathname;
  socket.search='';
  for(const key of seat?['slot','token']:[]){const value=page.searchParams.get(key);if(value!==null)socket.searchParams.set(key,value);}
 }
 socket.hash='';
 return socket.href;
}
export function viewerConnection(href:string){
 const page=new URL(href),isSeatInspector=/\/client\/player\/?$/.test(page.pathname);
 return {socket:socketAddress(page,isSeatInspector?'/inspect':'/global',isSeatInspector),isSeatInspector};
}
export function playerConnection(href:string){
 const page=new URL(href),socket=socketAddress(page,'/human',true);
 const root=new URL(page.href);root.pathname=root.pathname.replace(/\/client\/player\/?$/,'/');root.search='';root.hash='';
 const replay=new URL('replay.json',root).href;
 const replayPage=new URL('client/replay',root);replayPage.searchParams.set('replay',replay);
 const hosted=[page,new URL(socket)].some(url=>url.hostname==='softmax.com'||url.hostname.endsWith('.softmax.com'));
 return {socket,replay,replayPage:hosted?'https://softmax.com/observatory/v2':replayPage.href,
  replayLabel:hosted?'Open Softmax':'Watch replay',
  replayNotice:hosted?'Your replay will be available on Softmax after the episode finishes processing. Open your completed game in the Observatory and select its replay.':'The completed replay is saved by the local host.'};
}
