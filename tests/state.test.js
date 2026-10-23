import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateImport,loadState,saveState,mergeState,STORAGE_KEY} from '../docs/assets/state.js';
const valid=['01','02'];
test('state round trip keeps notes and completion',()=>{
  const memory=new Map();const storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
  const state=emptyState();state.chapters['01']={note:'资料更新后复算。',done:true};state.last='01';
  saveState(storage,state);
  const actual=loadState(storage,valid);
  assert.equal(actual.chapters['01'].note,state.chapters['01'].note);
  assert.equal(actual.chapters['01'].done,true);
  assert.equal(actual.last,'01');
  assert.ok(memory.has(STORAGE_KEY));
});
test('invalid or inaccessible storage has a safe initial state',()=>{
  assert.deepEqual(loadState({getItem:()=>'{bad json'},valid),emptyState());
  assert.deepEqual(loadState(null,valid),emptyState());
  assert.throws(()=>saveState({setItem(){throw new Error('quota');}},emptyState()));
});
test('imports reject invalid schema, oversized notes and unknown ids',()=>{
  assert.throws(()=>validateImport({version:1,chapters:{}},valid));
  assert.throws(()=>validateImport({version:2,chapters:[]},valid));
  assert.throws(()=>validateImport({version:2,chapters:{'01':{note:'x'.repeat(20001)}}},valid));
  const actual=validateImport(JSON.parse('{"version":2,"chapters":{"__proto__":{"note":"bad"},"unknown":{"note":"bad"},"01":{"note":"ok"}}}'),valid);
  assert.deepEqual(Object.keys(actual.chapters),['01']);
  assert.equal({}.note,undefined);
});
test('merge keeps untouched chapters and imported text stays text',()=>{
  const current={...emptyState(),chapters:{'01':{note:'old'},'02':{note:'keep'}}};
  const incoming=validateImport({version:2,chapters:{'01':{note:'<img onerror=alert(1)>'}}},valid);
  const merged=mergeState(current,incoming);
  assert.equal(merged.chapters['02'].note,'keep');
  assert.equal(merged.chapters['01'].note,'<img onerror=alert(1)>');
});
