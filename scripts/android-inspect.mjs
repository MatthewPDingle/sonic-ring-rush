import { writeFile } from 'node:fs/promises';
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const target=targets.find(t=>t.url.startsWith('https://appassets.androidplatform.net/'));
if(!target)throw Error('No game WebView target');
const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let id=0;
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
socket.addEventListener('message',event=>{const response=JSON.parse(event.data);if(response.id){const promise=pending.get(response.id);pending.delete(response.id);response.error?promise.reject(response.error):promise.resolve(response.result);}});
function send(method,params={}){return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});socket.send(JSON.stringify({id:key,method,params}));});}
try {
 const expression=process.argv[2]||'JSON.stringify({title:document.title,url:location.href,text:document.body.innerText,state:window.__ringRush?.state,width:innerWidth,height:innerHeight,dpr:devicePixelRatio})';
 const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 console.log(JSON.stringify(response,null,2));
 if(process.argv.includes('--screen')){const screenshot=await send('Page.captureScreenshot',{format:'png'});await writeFile('output/android/webview-screen.png',Buffer.from(screenshot.data,'base64'));}
} finally {socket.close();}
