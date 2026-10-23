export const STORAGE_KEY='agent-engineering-notes:v2';
export function emptyState(){return {version:2,chapters:{},last:'',updated:''};}
export function validateImport(input,validIds){
  if(!input||input.version!==2||!input.chapters||typeof input.chapters!=='object'||Array.isArray(input.chapters))throw new Error('这不是本课程的学习记录文件。');
  const state=emptyState();
  for(const [id,row] of Object.entries(input.chapters)){
    if(!validIds.includes(id)||!row||typeof row!=='object')continue;
    const result={done:Boolean(row.done)};
    for(const key of ['note','answer']){const value=row[key]??'';if(typeof value!=='string'||value.length>20000)throw new Error('笔记字段格式不正确或过长。');result[key]=value;}
    state.chapters[id]=result;
  }
  state.last=validIds.includes(input.last)?input.last:'';
  state.updated=typeof input.updated==='string'?input.updated:'';
  return state;
}
export function loadState(storage,validIds){try{const raw=storage.getItem(STORAGE_KEY);return raw?validateImport(JSON.parse(raw),validIds):emptyState();}catch{return emptyState();}}
export function saveState(storage,state){const updated={...state,updated:new Date().toISOString()};storage.setItem(STORAGE_KEY,JSON.stringify(updated));return updated;}
export function mergeState(current,incoming){return {...current,chapters:{...current.chapters,...incoming.chapters},last:incoming.last||current.last};}
