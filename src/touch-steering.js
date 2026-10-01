// Normalize horizontal position, leaving a small forgiving neutral area.
export function steeringFromPosition(x, left, width, deadZone = .06) {
  if(!Number.isFinite(x)||!Number.isFinite(left)||!Number.isFinite(width)||width<=0)return 0;
  const value=Math.max(-1,Math.min(1,(x-left)/width*2-1));
  return Math.abs(value)<=deadZone ? 0 : Math.sign(value)*(Math.abs(value)-deadZone)/(1-deadZone);
}

export function createSteeringPad(element, onChange) {
  let activePointer=null, value=0, direction=0;
  function set(next) {
    value=Math.max(-1,Math.min(1,next));
    const travel=Math.max(1,element.getBoundingClientRect().width/2-28);
    element.style.setProperty('--steer-x',`${value*travel}px`);
    element.style.setProperty('--steer-fill',`${Math.abs(value)*travel}px`);
    element.style.setProperty('--steer-direction',value<0?'-1':'1');
    element.classList.toggle('steering-active',value!==0||activePointer!==null);
    element.setAttribute('aria-valuenow',String(Math.round(value*100)));
    element.setAttribute('aria-valuetext',value===0?'Ready to change lane':`${value<0?'Left':'Right'} lane`);
    const command=Math.abs(value)>=.45?Math.sign(value):Math.abs(value)<.2?0:direction;
    if(command!==direction){direction=command;onChange(direction);}
  }
  function position(event) {
    const rect=element.getBoundingClientRect();
    set(steeringFromPosition(event.clientX,rect.left+28,Math.max(1,rect.width-56)));
  }
  function reset() {
    const pointer=activePointer; activePointer=null; set(0);
    if(pointer!==null&&element.hasPointerCapture(pointer))element.releasePointerCapture(pointer);
  }
  element.addEventListener('pointerdown',event=>{
    if(activePointer!==null||event.button!==0)return;
    event.preventDefault();activePointer=event.pointerId;element.setPointerCapture(event.pointerId);position(event);
  });
  element.addEventListener('pointermove',event=>{if(event.pointerId===activePointer){event.preventDefault();position(event);}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(type,event=>{if(event.pointerId===activePointer)reset();});
  element.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.code))return;
    event.preventDefault();event.stopPropagation();
    set(event.code==='Home'?-1:event.code==='End'?1:event.code==='ArrowLeft'?-.7:.7);
  });
  element.addEventListener('keyup',event=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(event.code)){event.stopPropagation();reset();}});
  element.addEventListener('blur',reset);
  set(0);
  return {reset};
}
