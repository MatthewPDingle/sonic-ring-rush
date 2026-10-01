import { writeFile } from 'node:fs/promises';
export const delay=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds));
export async function connectGame(port=9333) {
  const targets=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const target=targets.find(t=>t.url.startsWith('https://appassets.androidplatform.net/'));
  if(!target)throw Error('No game WebView inspector found');
  const socket=new WebSocket(target.webSocketDebuggerUrl),pending=new Map();let id=0;
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  const errors=[];
  socket.addEventListener('message',event=>{
    const response=JSON.parse(event.data);
    if(response.id){const promise=pending.get(response.id);pending.delete(response.id);if(!promise)return;clearTimeout(promise.timeout);response.error?promise.reject(response.error):promise.resolve(response.result);}
    else if(response.method==='Runtime.exceptionThrown')errors.push(response.params.exceptionDetails.text);
  });
  function send(method,params={}) {return new Promise((resolve,reject)=>{const key=++id;const timeout=setTimeout(()=>{pending.delete(key);reject(Error(`Inspector timed out: ${method}`));},15000);pending.set(key,{resolve,reject,timeout});socket.send(JSON.stringify({id:key,method,params}));});}
  async function evaluate(expression) {const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw Error(response.exceptionDetails.text);return response.result.value;}
  async function wait(expression,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){const value=await evaluate(expression);if(value)return value;await delay(100);}throw Error(`Timed out: ${expression}`);}
  async function center(selector){const point=await evaluate(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return null;const r=b.getBoundingClientRect();return r.width>0&&r.height>0 ? {x:r.x+r.width/2,y:r.y+r.height/2}:null;})()`);if(!point)throw Error(`No UI control: ${selector}`);return point;}
  async function touch(type,points=[]){await send('Input.dispatchTouchEvent',{type,touchPoints:points.map((point,i)=>({...point,id:point.id??i,radiusX:5,radiusY:5,force:1}))});}
  async function tap(selector,duration=80){await touch('touchStart',[await center(selector)]);await delay(duration);await touch('touchEnd');}
  async function screenshot(path){const result=await send('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(result.data,'base64'));}
  await send('Runtime.enable');
  return {send,evaluate,wait,center,touch,tap,screenshot,errors,close:()=>socket.close()};
}
