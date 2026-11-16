export const EMA_DATA_CHANNEL='ema-data-v1';
export function notifyEmaDataChanged(){
  if(typeof window==='undefined')return;
  window.dispatchEvent(new Event('ema:data-changed'));
  try{const channel=new BroadcastChannel(EMA_DATA_CHANNEL);channel.postMessage({type:'changed'});channel.close();}catch{/* Focus refresh still works without BroadcastChannel. */}
}
export function listenForEmaChanges(refresh:()=>void){
  const update=()=>{if(!document.hidden)refresh();};
  window.addEventListener('ema:data-changed',update);
  window.addEventListener('focus',update);
  document.addEventListener('visibilitychange',update);
  let channel:BroadcastChannel|undefined;
  try{channel=new BroadcastChannel(EMA_DATA_CHANNEL);channel.onmessage=update;}catch{}
  return()=>{window.removeEventListener('ema:data-changed',update);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update);channel?.close();};
}
