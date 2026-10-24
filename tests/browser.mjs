import {createRequire} from 'node:module';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../.qa/package.json',import.meta.url));
const {chromium}=require('playwright');
const {AxeBuilder}=require('@axe-core/playwright');
const base=process.env.COURSE_BASE_URL||'http://127.0.0.1:8092/agent-engineering-notes/';
const reportPath=process.env.COURSE_QA_REPORT||'qa-artifacts/round-2-browser.json';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-gpu','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
const page=await context.newPage();
const failures=[],checks=[],accessibility=[],requests=[];
fs.mkdirSync('qa-artifacts',{recursive:true});
page.on('pageerror',e=>failures.push(e.message));
page.on('dialog',d=>{failures.push(`unexpected dialog: ${d.message()}`);d.dismiss();});
page.on('request',request=>requests.push(request.url()));
function check(name,value){assert.ok(value,name);checks.push(name);console.log(`PASS ${name}`);}
async function go(route){await page.goto(base+'#'+route);await page.locator(`#main[data-route="${route}"]`).waitFor();}
async function mobileHidden(){await page.waitForFunction(()=>innerWidth>760||new DOMMatrix(getComputedStyle(document.querySelector('#sidebar')).transform).m41<=-262);}
async function screenshot(path){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path,animations:'disabled'});}
async function axe(route){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();accessibility.push({route,violations:result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary})).slice(0,10)}))});}

try{
  await go('overview');
  check('eight chapters on overview',await page.locator('.contents-row').count()===8);
  check('no login or server dependency',await page.locator('input[type=password]').count()===0&&!requests.some(url=>/\/api\//.test(new URL(url).pathname)));
  await screenshot('qa-artifacts/home-desktop.png');await axe('overview');
  const course=await page.evaluate(()=>fetch(new URL('data/course.json',location.href)).then(r=>r.json()));
  for(const ch of course.chapters){
    await go(ch.id);
    check(`chapter ${ch.id} title and source content`,(await page.locator('h1').innerText())===ch.title&&await page.locator('.prose>p').count()===ch.blocks.filter(b=>b.kind==='p').length);
    check(`chapter ${ch.id} interactive lab`,await page.locator('.lab-title').count()>=1);
    await page.fill('#note',`第 ${ch.id} 节：记录一个具体的输入与结果。`);
    await page.check('#done');
    if(ch.id==='01'){
      await page.locator('[data-fault="true"]').click();await page.locator('[data-next]').click();
      check('failure observation in loop',(await page.locator('.console').innerText()).includes('TEMPORARY_UNAVAILABLE'));
      await page.locator('[data-next]').focus();await page.keyboard.press('Enter');
      check('keyboard loop activation',(await page.locator('.console').innerText()).includes('51768'));
      check('keyboard focus remains in lab',await page.evaluate(()=>Boolean(document.activeElement?.closest('.lab'))));
    }
    if(ch.id==='02'){
      await page.fill('#expression','0.1 + 0.2');await page.locator('.input-row button').click();
      check('calculator exact result',(await page.locator('.calculation-output').innerText()).includes('3/10'));
      await page.fill('#expression','1 / 0');await page.locator('.input-row button').click();
      check('calculator error feedback',(await page.locator('.calculation-output').innerText()).includes('除数为 0'));
      await axe('02');
    }
    if(ch.id==='03'){
      await page.locator('.lab[data-lab=recovery] [data-next]').click();
      check('real recovery trace',(await page.locator('.lab[data-lab=recovery] .console').innerText()).includes('51768'));
      await page.locator('[data-choice="1"]').click();check('reconnect uses persistent state',(await page.locator('.choice-feedback').innerText()).includes('查询'));
    }
    if(ch.id==='04'){
      await page.locator('[data-size="1028"]').click();check('larger corpus tokens',(await page.locator('.bars').innerText()).includes('61,593'));
      await page.selectOption('#metric','seconds');check('larger corpus latency',(await page.locator('.bars').innerText()).includes('30.58'));
      await page.locator('.lab').scrollIntoViewIfNeeded();await screenshot('qa-artifacts/context-desktop.png');await axe('04');
    }
    if(ch.id==='05'){
      await page.selectOption('#verification-case','1');check('wrong formula caught by task scoring',(await page.locator('.check-results .no').innerText())==='未通过');
      check('wrong formula still passes execution consistency',await page.locator('.check-results .yes').count()===2);
      await page.selectOption('#verification-case','2');check('unfinished result rejected',await page.locator('.check-results .no').count()===1);
    }
    if(ch.id==='06'){
      for(const id of ['codex','claude','pi','opencode']){await page.locator(`[data-agent="${id}"]`).click();assert.ok(await page.locator('.tour-steps li').count()===3);}
      check('four implementation tours',true);await axe('06');
    }
    if(ch.id==='07'){
      await page.selectOption('#task-filter','math-inventory');check('evaluation filter keeps denominator',(await page.locator('.lab tbody').innerText()).includes('1/1'));
    }
    if(ch.id==='08'){
      await page.fill('#project-change','保存来源版本，并使旧库存计算失效。');await page.fill('#project-against','若漏失效降低严格任务成功率，就撤销改动。');await page.locator('.project-form button[type=submit]').click();
      check('project plan is explicitly unmeasured',(await page.locator('.project-output').innerText()).includes('plan_not_measured'));
      const [plan]=await Promise.all([page.waitForEvent('download'),page.locator('[data-export]').click()]);check('project plan download',plan.suggestedFilename()==='agent-experiment-plan.json');
      await page.locator('summary').filter({hasText:'失效传播'}).click();await page.locator('[data-update]').click();assert.equal(await page.locator('.stale').count(),2);await page.locator('[data-initial]').click();await page.locator('[data-remaining]').click();
      check('inventory revision recalculates derived values',(await page.locator('.dependency-chain').innerText()).includes('50,096')&&await page.locator('.stale').count()===0);
      await axe('08');
    }
  }
  await go('01');check('notes survive navigation',(await page.inputValue('#note')).includes('第 01 节'));await page.reload();await page.locator('#main[data-route="01"]').waitFor();check('notes survive refresh',(await page.inputValue('#note')).includes('第 01 节'));
  await go('notes');check('eight completed chapters',(await page.locator('#done-count').innerText())==='8');await axe('notes');
  const [md]=await Promise.all([page.waitForEvent('download'),page.locator('#export-md').click()]);check('Markdown export',md.suggestedFilename()==='agent-project-notes.md');
  const [record]=await Promise.all([page.waitForEvent('download'),page.locator('#export-json').click()]);check('JSON export',record.suggestedFilename()==='agent-learning-record.json');
  const importData={version:2,chapters:{'01':{done:true,note:'<img src=x onerror=alert(1)> 作为普通文本保留。'}},last:'01'};
  await page.setInputFiles('#import-file',{name:'record.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(importData))});
  await page.waitForFunction(()=>document.querySelector('.note-list')?.textContent.includes('<img src=x onerror=alert(1)>'));
  check('import is escaped as text',(await page.locator('.note-list').innerText()).includes('<img src=x onerror=alert(1)>')&&await page.locator('img[src=x]').count()===0);
  await go('references');check('fourteen source cases',await page.locator('.reference-card').count()===14);await axe('references');await page.fill('#reference-search','Stanford');check('reference search',await page.locator('.reference-card').count()>=1&&await page.locator('.reference-card').count()<14);
  await page.locator('#search').click();await page.fill('#search-input','修订单');check('chapter text search',await page.locator('#search-results>a').count()>=1);await page.keyboard.press('Escape');
  await go('experiments');await page.selectOption('#trial-select','pilot-20261023:2');check('real record picker',await page.locator('.trial-question').count()===1);
  const downloadResponse=await context.request.get(base+'lab/agent-lab.zip');check('lab ZIP served from repository subpath',downloadResponse.ok());
  for(const width of [390,768,1440]){
    await page.setViewportSize({width,height:900});
    for(const route of ['overview','01','02','04','06','08','references','notes','experiments']){await go(route);await mobileHidden();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow on ${route}`);}
    check(`no horizontal overflow at ${width}px`,true);
  }
  await page.setViewportSize({width:390,height:844});await go('overview');await mobileHidden();await screenshot('qa-artifacts/home-mobile.png');
  await page.locator('#menu').click();await page.locator('#close-nav').click();await mobileHidden();check('mobile close button',true);
  await page.locator('#menu').click();await page.locator('#nav-backdrop').click({position:{x:375,y:75}});await mobileHidden();check('mobile outside dismissal',true);
  await page.locator('#menu').click();await page.locator('[data-chapter="02"]').click();await page.locator('#main[data-route="02"]').waitFor();await mobileHidden();await page.locator('.lab').scrollIntoViewIfNeeded();await screenshot('qa-artifacts/calculator-mobile.png');
  check('all requests stay on this static site',requests.every(url=>url.startsWith(base)||url.startsWith('blob:')));
  check('representative pages pass automated accessibility rules',accessibility.every(row=>row.violations.length===0));
  check('no uncaught errors',failures.length===0);
}catch(error){failures.push(error.message);console.error(error);}
finally{fs.writeFileSync(reportPath,JSON.stringify({checked_at:new Date().toISOString(),base,checks,failures,accessibility},null,2));await browser.close();}
if(failures.length)process.exitCode=1;
