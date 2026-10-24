import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createScene,sceneCatalog} from '../docs/assets/motion-data.js';
const experiments=JSON.parse(fs.readFileSync(new URL('../src/experiments.json',import.meta.url)));
const agents=JSON.parse(fs.readFileSync(new URL('../src/agents.json',import.meta.url)));
const data={experiments,agents};

test('all eight timelines resolve their graph, source and code references',()=>{
  assert.equal(sceneCatalog.length,8);
  for(const {id} of sceneCatalog){
    const scene=createScene(id,{},data),nodes=new Set(scene.nodes.map(n=>n.id)),edges=new Set(scene.edges.map(e=>e.id));
    assert.equal(nodes.size,scene.nodes.length);
    for(const edge of scene.edges){assert.ok(nodes.has(edge.from));assert.ok(nodes.has(edge.to));}
    for(const frame of scene.frames){
      assert.ok(frame.active.every(id=>nodes.has(id)));
      assert.ok(frame.edges.every(id=>edges.has(id)));
      assert.ok(Number.isInteger(frame.line)&&frame.line>=0&&frame.line<scene.code.length);
      assert.ok(frame.text&&frame.todo&&frame.payload);
    }
  }
});

test('wrong formula remains a valid calculation but fails the external inventory task',()=>{
  const good=createScene('02',{},data),bad=createScene('02',{formula:'wrong'},data);
  assert.equal(good.frames.at(-1).payload.task_success,true);
  assert.equal(bad.frames.at(-1).payload.execution_consistent,true);
  assert.equal(bad.frames.at(-1).payload.task_success,false);
  assert.equal(bad.frames[3].payload.value,String(411*152-11260-708-152));
  assert.equal(createScene('05',{check:'unfinished'},data).result.task_success,false);
});

test('recovery playback preserves the saved actions and observations without invented reads',()=>{
  const trial=experiments.trials.find(t=>t.run==='recovery-20261023');
  const scene=createScene('03',{},data);
  assert.equal(scene.trialId,trial.id);
  assert.deepEqual(scene.frames[0].payload,trial.trace[0].action);
  assert.deepEqual(scene.frames[1].payload,trial.trace[0].observation);
  assert.deepEqual(scene.frames[2].payload,trial.trace[1].action);
  assert.deepEqual(scene.frames[3].payload,trial.trace[1].observation);
  assert.equal(scene.frames.at(-1).payload.model_calls,trial.model_calls);
  const truncated=createScene('03',{recovery:'budget'},data);
  assert.match(truncated.label,/假设/);
  assert.equal(truncated.frames.at(-1).payload.task_success,false);
});

test('both corpus scales use actual complete-task measurements and the exact search trace',()=>{
  for(const size of ['100','1028']){
    const scene=createScene('04',{size},data);
    for(const row of Object.values(scene.comparison)){
      const original=experiments.trials.find(t=>t.id===row.trial);
      assert.equal(row.input_tokens,original.usage.input_tokens);
      assert.equal(row.model_calls,original.model_calls);
      assert.equal(row.elapsed_s,original.elapsed_s);
    }
    const indexed=experiments.trials.find(t=>t.id===scene.comparison.retrieval.trial);
    assert.deepEqual(scene.frames[2].payload,indexed.trace[0]);
    assert.deepEqual(scene.frames[3].payload,indexed.trace[1]);
    assert.equal(scene.comparison.retrieval.model_calls,3);
  }
});

test('architecture paths do not send model outputs directly to tools',()=>{
  for(const agent of ['codex','claude','pi','opencode']){
    const scene=createScene('06',{agent},data);
    assert.equal(scene.agent,agent);
    assert.ok(!scene.edges.some(e=>e.from==='model'&&e.to==='tools'));
    for(const node of scene.nodes)assert.ok(scene.sources.some(s=>s.id===node.source));
  }
});

test('main comparison retains all 18 tasks and 23 observed model decisions',()=>{
  const scene=createScene('07',{},data);
  assert.equal(scene.summary.reduce((n,r)=>n+r.total,0),18);
  assert.equal(scene.summary.reduce((n,r)=>n+r.model_calls,0),23);
  assert.ok(scene.summary.every(r=>r.passed===6&&r.total===6));
  assert.equal(scene.frames.at(-1).payload.accuracy_difference_observed,false);
});

test('source revision invalidates both derived values and exposes a stale cache counterexample',()=>{
  const expected=String(400*152-11260+708-152);
  const proper=createScene('08',{},data),missed=createScene('08',{invalidation:'missed'},data);
  assert.deepEqual(proper.frames[2].stale,['initial','remaining']);
  assert.equal(proper.result.actual,expected);
  assert.equal(proper.result.task_success,true);
  assert.equal(missed.result.actual,String(411*152-11260+708-152));
  assert.equal(missed.result.expected,expected);
  assert.equal(missed.result.task_success,false);
});
