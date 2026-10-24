import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../.qa/package.json',import.meta.url));
const {chromium}=require('playwright');
const {AxeBuilder}=require('@axe-core/playwright');
const base=process.env.COURSE_BASE_URL||'http://127.0.0.1:8092/agent-engineering-notes/';
const reportPath=process.env.COURSE_QA_REPORT||'qa-artifacts/motion-browser.json';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1080},deviceScaleFactor:1});
await context.addInitScript(()=>{
  const request=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
  const pending=new Set();window.__pendingAnimationFrames=pending;
  window.requestAnimationFrame=callback=>{const id=request(time=>{pending.delete(id);callback(time);});pending.add(id);return id;};
  window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id);};
});
const page=await context.newPage(),checks=[],failures=[],accessibility=[],requests=[];
const root=()=>page.locator('.motion-player');
page.on('pageerror',e=>failures.push(e.message));
page.on('request',r=>requests.push(r.url()));
fs.mkdirSync('qa-artifacts/motion',{recursive:true});
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log(`PASS ${name}`);};
async function go(id){await page.goto(base+'#animations/'+id);await page.locator(`.motion-player[data-motion-id="${id}"][data-layout]`).waitFor();}
async function frame(number){await page.locator(`[data-motion-frame="${number}"]`).click();assert.equal(await root().getAttribute('data-frame'),String(number));}
const payload=async()=>JSON.parse(await page.locator('.motion-evidence pre').textContent());
async function end(){await page.locator('[data-motion-seek]').focus();await page.keyboard.press('End');}
async function axe(name){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();accessibility.push({name,violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})).slice(0,12)}))});}
async function image(name){await root().screenshot({path:`qa-artifacts/motion/${name}.png`,animations:'disabled'});}

try{
  for(const id of ['01','02','03','04','05','06','07','08']){
    await go(id);
    check(`scene ${id} starts paused`,await root().getAttribute('data-playing')==='false');
    check(`scene ${id} has a wired graph`,await page.locator('[data-motion-node]').count()===6&&await page.locator('.motion-edge').evaluateAll(paths=>paths.every(p=>p.getTotalLength()>0&&!p.getAttribute('d').includes('NaN'))));
    const steps=await page.locator('[data-motion-frame]').count();
    for(let i=0;i<steps;i++){await frame(i);assert.equal(await page.locator('[data-code-line].is-current').count(),1);assert.ok((await page.locator('.motion-current-text').innerText()).length>10);}
    check(`scene ${id} steps and code stay in sync`,true);
    await page.locator('[data-motion-node]').first().click();
    check(`scene ${id} node inspection`,(await page.locator('.motion-inspector p').innerText()).length>10);
    if(['01','03','06','08'].includes(id))await image(`checked-${id}-desktop`);
    await axe(`animation-${id}`);
  }
  await go('01');await page.locator('[data-motion-speed]').selectOption('2');
  await page.locator('[data-motion-toggle]').click();
  await page.waitForFunction(()=>document.querySelector('.motion-player')?.dataset.frame==='1');
  const before=await page.locator('.motion-particle').first().getAttribute('cx');await page.waitForTimeout(140);
  check('playing moves a data packet along its wire',before!==await page.locator('.motion-particle').first().getAttribute('cx'));
  await page.locator('[data-motion-toggle]').click();
  const paused=await root().getAttribute('data-frame'),position=await page.locator('.motion-particle').first().getAttribute('cx');await page.waitForTimeout(200);
  check('pause freezes both stage and data packet',await root().getAttribute('data-frame')===paused&&await page.locator('.motion-particle').first().getAttribute('cx')===position);
  await root().focus();await page.keyboard.press('ArrowRight');check('scoped keyboard next',Number(await root().getAttribute('data-frame'))===Number(paused)+1);
  await page.keyboard.press('ArrowLeft');check('scoped keyboard back',await root().getAttribute('data-frame')===paused);
  await page.locator('[data-motion-seek]').focus();await page.keyboard.press('End');
  check('native range keyboard seek reaches the end',await root().getAttribute('data-frame')==='6');
  await page.locator('[data-motion-reset]').click();check('restart restores the first frame',await root().getAttribute('data-frame')==='0');
  await root().focus();await page.keyboard.press(' ');check('space starts a focused player',await root().getAttribute('data-playing')==='true');await page.keyboard.press(' ');
  await go('02');await page.selectOption('[data-motion-option=formula]','wrong');
  check('option change keeps keyboard focus',await page.evaluate(()=>document.activeElement?.dataset.motionOption==='formula'));
  await end();check('wrong formula is rejected despite consistent execution',(await payload()).execution_consistent&&!(await payload()).task_success);
  await go('03');await frame(1);check('saved real failure is shown',(await payload()).error==='TEMPORARY_UNAVAILABLE');
  await page.selectOption('[data-motion-option=recovery]','budget');await end();check('counterfactual budget is labelled and incomplete',(await payload()).status==='step_budget_exhausted'&&(await page.locator('.motion-kind').innerText()).includes('假设'));
  await go('04');await page.selectOption('[data-motion-option=size]','100');
  check('100-document measurements stay exact',(await page.locator('.motion-measurements').innerText()).includes('15,171')&&(await page.locator('.motion-measurements').innerText()).includes('31,174'));
  await page.selectOption('[data-motion-option=size]','1028');check('1028-document measurements stay exact',(await page.locator('.motion-measurements').innerText()).includes('61,593')&&(await page.locator('.motion-measurements').innerText()).includes('31,175'));
  await image('context-measurements');
  await go('05');await page.selectOption('[data-motion-option=check]','unfinished');await end();check('unfinished correct answer fails the task',!(await payload()).task_success&&(await payload()).answer_correct);
  await go('06');
  for(const agent of ['codex','claude','pi','opencode']){
    await page.selectOption('[data-motion-option=agent]',agent);
    for(const node of await page.locator('[data-motion-node]').all()){await node.click();assert.equal(await page.locator('.motion-inspector a').count(),1);}
    check(`${agent} architecture exposes direct sources for every node`,true);
    await end();await axe(`architecture-${agent}`);
  }
  await image('opencode-reconnect');
  const supportsFullscreen=await root().evaluate(el=>Boolean(el.requestFullscreen));
  if(supportsFullscreen){await page.locator('[data-motion-fullscreen]').click();await page.waitForFunction(()=>Boolean(document.fullscreenElement));check('fullscreen uses the native viewport',await root().evaluate(el=>el.clientWidth>=innerWidth-5));await page.locator('[data-motion-fullscreen]').click();await page.waitForFunction(()=>!document.fullscreenElement);}
  await go('08');await frame(2);check('both stale results explicitly say they need recomputing',await page.locator('.motion-node.is-stale').count()===2&&await page.locator('.motion-node.is-stale .motion-node-state').evaluateAll(rows=>rows.every(r=>r.textContent.includes('待复算'))));await image('stale-dependencies');
  await end();check('propagated revision reaches 50096',(await payload()).actual==='50096'&&(await payload()).task_success);
  await page.selectOption('[data-motion-option=invalidation]','missed');await end();check('missing invalidation exposes the old 51768',(await payload()).actual==='51768'&&!(await payload()).task_success);await axe('missed-invalidation');
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const id of ['01','02','03','04','05','06','07','08']){await go(id);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow in ${id}`);}
    check(`eight scenes fit at ${width}px`,true);
    if(width===390){await go('06');await page.selectOption('[data-motion-option=agent]','opencode');await image('opencode-mobile');await axe('mobile-architecture');}
  }
  await page.goto(base+'#01');await page.locator('.motion-player[data-embedded=true]').waitFor();
  check('chapter contains its animation and the original runnable lab',await page.locator('[data-motion-id="01"]').count()===1&&await page.locator('[data-lab=loop]').count()===1);
  await page.locator('[data-motion-toggle]').click();await page.locator('#note').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>document.querySelector('.motion-player')?.dataset.playing==='false');
  check('scrolling away pauses the player',true);
  await page.locator('[data-motion-toggle]').scrollIntoViewIfNeeded();await page.locator('[data-motion-toggle]').click();
  await page.goto(base+'#notes');await page.locator('#export-json').waitFor();await page.waitForTimeout(100);
  check('navigation disposes the animation loop',await page.evaluate(()=>window.__pendingAnimationFrames.size===0));
  await page.emulateMedia({reducedMotion:'reduce'});await go('01');
  check('reduced-motion preference is explained',(await page.locator('.motion-footnote').innerText()).includes('减少移动'));
  await page.locator('[data-motion-speed]').selectOption('2');await page.locator('[data-motion-toggle]').click();await page.waitForFunction(()=>document.querySelector('.motion-player')?.dataset.frame==='1');
  const still=await page.locator('.motion-particle').first().getAttribute('cx');await page.waitForTimeout(120);
  check('reduced-motion playback keeps packets still within each step',still===await page.locator('.motion-particle').first().getAttribute('cx'));
  await page.locator('[data-motion-toggle]').click();
  check('all network requests remain inside this static site',requests.every(url=>url.startsWith(base)||url.startsWith('blob:')));
  check('automated accessibility checks pass for all inspected states',accessibility.every(row=>row.violations.length===0));
  check('no uncaught browser errors',failures.length===0);
}catch(error){failures.push(error.message);console.error(error);}
finally{fs.writeFileSync(reportPath,JSON.stringify({checked_at:new Date().toISOString(),base,checks,failures,accessibility},null,2));await browser.close();}
if(failures.length)process.exitCode=1;
