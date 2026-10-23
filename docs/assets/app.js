import {loadState,saveState,validateImport,mergeState} from './state.js';
import {mountLab} from './labs.js';

const $=(s,root=document)=>root.querySelector(s);
const $$=(s,root=document)=>[...root.querySelectorAll(s)];
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=new URL('../',import.meta.url);
const file=path=>new URL(path,base).href;
let course,experiments,agents,reviewLog,state,storage,noticeTimer;
try{storage=window.localStorage;}catch{storage=null;}

function notice(text){const node=$('#notice');node.textContent=text;node.classList.add('show');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>node.classList.remove('show'),3600);}
function persist(){try{state=saveState(storage,state);return true;}catch{notice('浏览器未能保存记录。可以先导出，再继续学习。');return false;}}
function entry(id){return state.chapters[id]||{done:false,note:'',answer:''};}
function closeNav(){$('#sidebar')?.classList.remove('open');$('#menu')?.setAttribute('aria-expanded','false');}
function doneCount(){return course.chapters.filter(ch=>entry(ch.id).done).length;}

function shell(){
  $('#app').innerHTML=`<aside id="sidebar" class="sidebar"><button id="close-nav" class="close-nav" aria-label="关闭目录">×</button><a href="#overview" class="brand"><span class="terminal-mark">&gt;_</span><span>Agent 工程笔记<small>一个可以动手改的小项目</small></span></a><button class="search" id="search"><span>搜索正文</span><kbd>/</kbd></button><nav class="chapter-nav" aria-label="章节目录">${course.chapters.map(ch=>`<a href="#${ch.id}" data-chapter="${ch.id}"><span>${ch.id}</span><strong>${esc(ch.title)}</strong><i>${entry(ch.id).done?'✓':''}</i></a>`).join('')}</nav><nav class="other-nav" aria-label="其他内容"><a href="#experiments">实验记录</a><a href="#implementations">实现走读</a><a href="#references">参考书架</a><a href="#notes">我的实践记录</a></nav><div class="sidebar-bottom"><div><span>已读 <b id="done-count">${doneCount()}</b> / 8</span><a href="#notes">导入 / 导出</a></div><p>记录保存在当前浏览器。</p></div></aside><button class="nav-backdrop" id="nav-backdrop" aria-label="关闭目录"></button><div class="workspace"><header class="topbar"><button id="menu" class="menu" aria-label="展开目录" aria-expanded="false" aria-controls="sidebar">☰</button><a href="#overview" class="home-link">教程</a><span id="crumb"></span><a href="${esc(course.repo)}" class="repo-link" target="_blank" rel="noopener noreferrer">GitHub ↗</a></header><main id="main" tabindex="-1"></main><footer><span>Agent 工程笔记 · ${esc(course.version)}</span><a href="#references">参考来源</a><a href="#reviews">三轮审阅记录</a></footer></div>`;
  $('#menu').onclick=()=>$('#menu').setAttribute('aria-expanded',String($('#sidebar').classList.toggle('open')));
  $('#close-nav').onclick=closeNav;$('#nav-backdrop').onclick=closeNav;
  $$('.sidebar a').forEach(a=>a.onclick=closeNav);
  $('#search').onclick=openSearch;
}

function overview(){
  const resume=course.chapters.find(ch=>ch.id===state.last&&!entry(ch.id).done)||course.chapters.find(ch=>!entry(ch.id).done)||course.chapters[0];
  $('#main').innerHTML=`<div class="intro"><div><p class="kicker">一份带代码和实验记录的教程</p><h1>Agent 工程笔记</h1><p class="intro-text">${esc(course.subtitle)}</p><p>从读取一张单据开始。每次遇到一个具体问题，就改一处程序，再检查改动有没有用。最后再带着这些问题，去读成熟 Agent 的实现。</p><div class="actions"><a class="button primary" href="#${resume.id}">${state.last?'继续阅读':'从第一节开始'} →</a><a class="button" href="${file('lab/agent-lab.zip')}" download>下载 Python 实验包</a></div></div><div class="sample-record"><div class="sample-header">本教程的任务 <span>inventory</span></div><p>核对本期可售库存。</p><dl><div><dt>初始库存</dt><dd>411 箱 × 152 件</dd></div><div><dt>已发出</dt><dd>11,260 件</dd></div><div><dt>可售退货</dt><dd>708 件</dd></div><div><dt>本期报损</dt><dd>152 件</dd></div></dl><pre>read → calculate → finish\n结果：51768</pre><small>固定脚本也能完成这道题。后面再逐步加入变化。</small></div></div>
    <section class="start-note"><h2>怎么使用</h2><p>网页里的计算器与演示可以直接操作。下载包先跑确定性测试；需要测模型时，再切换到已登录的 Codex 后端。准备一份自己的记录：改了什么、看到了什么、还没解释什么。</p><details><summary>开始之前需要什么？</summary><ul>${course.preparation.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details></section>
    <section class="contents"><div class="section-heading"><h2>正文</h2><span>8 节，按问题推进</span></div>${course.chapters.map(ch=>`<a href="#${ch.id}" class="contents-row"><span>${ch.id}</span><div><h3>${esc(ch.title)}</h3><p>${esc(ch.deck)}</p></div><small>${esc(ch.time)}</small><i>${entry(ch.id).done?'✓':'→'}</i></a>`).join('')}</section>
    <section class="reading-note"><h2>这次重写参考了什么</h2><p>Minimal Agent 的小循环、Hugging Face 的单文件练习、Stanford CS329Z 的测试与实验安排，是这份教程的主要组织参考。其余课程和原始文档放在书架里，逐项写明借鉴和取舍。</p><a href="#references" class="inline-link">查看 14 组案例与直接来源 →</a></section>`;
}

function blockHtml(block,index){
  switch(block.kind){
    case 'p':return `<p>${esc(block.text)}</p>`;
    case 'heading':return `<h2 id="section-${index}">${esc(block.text)}</h2>`;
    case 'code':return `<div class="code-block"><div class="code-caption"><span>${esc(block.caption)}</span><button data-copy="${index}">复制</button></div><pre><code>${esc(block.text)}</code></pre>${block.file?`<a href="${file(`lab/${block.file}`)}" target="_blank" rel="noopener noreferrer">打开完整文件：${esc(block.file)} ↗</a>`:''}</div>`;
    case 'table':return `<div class="table-scroll"><table><thead><tr>${block.head.map(s=>`<th>${esc(s)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row=>`<tr>${row.map(s=>`<td>${esc(s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    case 'lab':return `<div class="lab" data-lab="${block.name}"></div>`;
    case 'aside':return `<aside class="aside"><strong>${esc(block.title)}</strong><p>${esc(block.text)}</p></aside>`;
    case 'exercise':return `<section class="exercise"><div class="exercise-label">${esc(block.label||'动手改一处')}</div><h3>${esc(block.title)}</h3><ol>${block.steps.map(s=>`<li>${esc(s)}</li>`).join('')}</ol><details><summary>怎样检查结果</summary><p>${esc(block.expected)}</p>${block.hint?`<p>${esc(block.hint)}</p>`:''}</details></section>`;
    default:return '';
  }
}

function chapter(id){
  const ch=course.chapters.find(c=>c.id===id);const i=course.chapters.indexOf(ch),record=entry(id);
  state.last=id;persist();
  $('#main').innerHTML=`<header class="chapter-header"><div class="kicker">第 ${id} 节 · ${esc(ch.time)}</div><h1>${esc(ch.title)}</h1><p>${esc(ch.deck)}</p></header><div class="reader-layout"><article class="prose">${ch.blocks.map(blockHtml).join('')}
    <section class="practice-note" id="practice"><h2>实践记录</h2><label for="note">${esc(ch.prompt)}</label><textarea id="note" rows="6" maxlength="20000" placeholder="写下具体输入、动作、结果和仍未解决的问题。">${esc(record.note)}</textarea><div class="note-status"><span id="saved">${record.note?'已保存在当前浏览器':'输入后自动保存在当前浏览器'}</span><a href="#notes">导出记录 →</a></div></section>
    <section class="chapter-reading"><h3>继续读</h3>${ch.readings.map(n=>{const r=course.references[n];return `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a>`;}).join('')}</section>
    <div class="chapter-end"><label><input type="checkbox" id="done" ${record.done?'checked':''}>我读完并做过本节练习</label>${course.chapters[i+1]?`<a href="#${course.chapters[i+1].id}" class="button primary">下一节 →</a>`:'<a href="#notes" class="button primary">整理我的项目记录 →</a>'}</div><nav class="chapter-pager">${i?`<a href="#${course.chapters[i-1].id}">← ${esc(course.chapters[i-1].title)}</a>`:'<span></span>'}${course.chapters[i+1]?`<a href="#${course.chapters[i+1].id}">${esc(course.chapters[i+1].title)} →</a>`:''}</nav></article>
    <nav class="page-toc" aria-label="本节内容"><span>本节内容</span>${ch.blocks.map((b,n)=>b.kind==='heading'?`<a href="#section-${n}" data-scroll="section-${n}">${esc(b.text)}</a>`:'').join('')}<a href="#practice" data-scroll="practice">实践记录</a><a href="${file('lab/agent-lab.zip')}" download class="download-small">↓ 下载实验包</a></nav></div>`;
  $$('[data-scroll]').forEach(a=>a.onclick=e=>{e.preventDefault();document.getElementById(a.dataset.scroll)?.scrollIntoView({behavior:'smooth'});});
  $$('[data-copy]').forEach(b=>b.onclick=()=>copy(ch.blocks[+b.dataset.copy].text));
  $('#note').oninput=e=>{state.chapters[id]={...entry(id),note:e.target.value};if(persist())$('#saved').textContent='已保存在当前浏览器';else $('#saved').textContent='保存失败，可以先导出记录。';};
  $('#done').onchange=e=>{state.chapters[id]={...entry(id),done:e.target.checked};persist();updateProgress();};
  $$('[data-lab]').forEach(node=>mountLab(node.dataset.lab,node,{experiments,agents,course,file,esc,download,notice}));
}

function heading(title,lead){return `<header class="chapter-header"><h1>${esc(title)}</h1><p>${esc(lead)}</p></header>`;}
function experimentPage(){
  $('#main').innerHTML=heading('实验记录','这里是已保存的真实运行，不会因打开网页而重新调用模型。脚本测试与规则演示不计入这些成绩。')+`<div class="prose wide"><div class="lab" id="evaluation-lab"></div><h2>打开一次任务</h2><div class="lab" id="replay-lab"></div><h2>全文与检索</h2><div class="lab" id="context-lab"></div><aside class="aside"><strong>数据边界</strong><p>六题主对照、三次文档探索与一次注入故障，共 22 次任务、33 次模型决策。全是合成开发资料；没有默认四家产品的横向成绩，也没有公开基准的完整测试。</p></aside><details><summary>模型、条件与数据哈希</summary><pre>${esc(JSON.stringify(experiments.runs,null,2))}</pre></details></div>`;
  for(const [name,id] of [['evaluation','evaluation-lab'],['replay','replay-lab'],['context','context-lab']])mountLab(name,$(`#${id}`),{experiments,agents,course,file,esc,download,notice});
}
function implementationPage(){
  $('#main').innerHTML=heading('实现走读','每家选一个入口，追一条路径。公开文档、固定源码与本课程的判断分别说明。')+`<div class="prose wide"><div class="lab" id="implementation-lab"></div><p>这些资料用于理解设计，没有提供四家产品的可比成功率。源码快照记录的是本次核实版本，后续阅读请同时核对变更。</p></div>`;
  mountLab('implementations',$('#implementation-lab'),{experiments,agents,course,file,esc,download,notice});
}

function referencePage(){
  $('#main').innerHTML=heading('参考书架','记录实际看到了什么，以及哪一部分被用进这份教程。公开视频、登录课程和可运行实验的访问条件分开说明。')+
    `<div class="reference-intro"><p>共整理 14 组教学案例。它们不都适合从头学到尾：有的长于小循环，有的长于测试，有的适合作为概念地图。下面保留我们借鉴的做法，也记录没有照搬的部分。</p><label for="reference-search" class="sr-only">搜索参考资料</label><input type="search" id="reference-search" placeholder="搜索作者、框架或关键词…"></div><div id="reference-list"></div><section class="prose wide"><h2>另外几份原始资料</h2><ul>${course.extra_readings.map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></li>`).join('')}</ul><p>四家 Agent 的直接文档与固定源码入口放在<a href="#implementations">实现走读</a>中。这里的中文讲解、练习数据和交互重新编写；没有镜像外部课程、登录内容或视频。</p></section>`;
  const paint=()=>{const query=$('#reference-search').value.trim().toLowerCase();const rows=course.references.map((r,n)=>({...r,index:n})).filter(r=>JSON.stringify(r).toLowerCase().includes(query));$('#reference-list').innerHTML=rows.map(r=>`<section class="reference-card"><span class="reference-index">${String(r.index+1).padStart(2,'0')}</span><div><a class="reference-title" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a><p class="byline">${esc(r.author_or_org)}</p><dl><dt>借鉴</dt><dd>${esc(r.what_to_borrow)}</dd><dt>取舍</dt><dd>${esc(r.what_not_to_copy)}</dd><dt>适合怎样练</dt><dd>${esc(r.exercise_pattern)}</dd></dl><details><summary>访问范围与资料入口</summary><p>${esc(r.access)}</p>${(r.supporting_urls||[]).map(url=>`<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(url)} ↗</a>`).join('')}</details></div></section>`).join('')||'<p class="empty">没有匹配的资料。</p>';};$('#reference-search').oninput=paint;paint();
}

function markdown(){
  const lines=['# 我的 Agent 项目记录','',`课程版本：${course.version}`,''];
  for(const ch of course.chapters){const r=entry(ch.id);lines.push(`## ${ch.id} ${ch.title}`,'',`已读：${r.done?'是':'否'}`,'',r.note||'（尚未记录）','');}
  return lines.join('\n');
}
function notesPage(){
  $('#main').innerHTML=heading('我的实践记录','记录只保存在当前浏览器，不上传服务器。导出 JSON 可以换设备继续，导出 Markdown 可以整理成项目说明。')+
    `<div class="note-tools"><button class="button primary" id="export-md">导出 Markdown</button><button class="button" id="export-json">导出 JSON</button><label class="button import-label" for="import-file">导入记录<input type="file" id="import-file" accept="application/json,.json"></label></div><p class="local-note">清理浏览器站点数据会删除本机记录。导入时，同一章节采用文件中的记录，其他章节保留。</p><div class="note-list">${course.chapters.map(ch=>`<section class="note-card"><header><span>${ch.id}</span><h2><a href="#${ch.id}">${esc(ch.title)}</a></h2><small>${entry(ch.id).done?'已读':'未标记'}</small></header><p>${esc(entry(ch.id).note||'还没有记录。打开正文，在“实践记录”中填写。')}</p><a href="#${ch.id}" class="inline-link">继续编辑 →</a></section>`).join('')}</div>`;
  $('#export-md').onclick=()=>download('agent-project-notes.md',markdown(),'text/markdown;charset=utf-8');
  $('#export-json').onclick=()=>download('agent-learning-record.json',JSON.stringify(state,null,2),'application/json');
  $('#import-file').onchange=async e=>{const selected=e.target.files[0];if(!selected)return;try{if(selected.size>512000)throw new Error('记录文件超过 500 KB。');const incoming=validateImport(JSON.parse(await selected.text()),course.chapters.map(c=>c.id));state=mergeState(state,incoming);if(persist()){updateProgress();notesPage();notice('记录已导入当前浏览器。');}}catch(error){notice(error.message||'未能读取记录。');}};
}

function reviewsPage(){
  $('#main').innerHTML=heading('三轮审阅记录','每轮记录发现、修正和检查依据。补充回归测试不冒充另一轮审阅。')+`<div class="prose wide">${reviewLog.rounds?.length?reviewLog.rounds.map(round=>`<section class="review-card"><span class="kicker">第 ${round.round} 轮 · ${esc(round.date)}</span><h2>${esc(round.focus)}</h2><p>${esc(round.result)}</p><ul>${round.changes.map(s=>`<li>${esc(s)}</li>`).join('')}</ul><details><summary>检查依据</summary><pre>${esc(JSON.stringify(round.evidence,null,2))}</pre></details></section>`).join(''):'<p>审阅仍在进行，记录会随本版本更新。</p>'}</div>`;
}

function updateProgress(){
  $('#done-count').textContent=doneCount();
  $$('[data-chapter]').forEach(a=>$('i',a).textContent=entry(a.dataset.chapter).done?'✓':'');
}
function route(){
  if(!course)return;closeNav();let key='overview';try{key=decodeURIComponent(location.hash.slice(1))||'overview';}catch{}const ch=course.chapters.find(c=>c.id===key);
  $$('.sidebar a').forEach(a=>a.classList.toggle('active',a.hash===`#${key}`));
  $('#crumb').textContent=ch?`${ch.id} / ${ch.title}`:({overview:'',experiments:'实验记录',implementations:'实现走读',references:'参考书架',notes:'我的实践记录',reviews:'三轮审阅记录'}[key]||'');
  if(ch)chapter(key);else({overview,experiments:experimentPage,implementations:implementationPage,references:referencePage,notes:notesPage,reviews:reviewsPage}[key]||overview)();
  $('#main').dataset.route=key;document.title=ch?`${ch.title} · Agent 工程笔记`:'Agent 工程笔记';window.scrollTo(0,0);
}

async function copy(text){try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);else{const input=document.createElement('textarea');input.value=text;document.body.append(input);input.select();document.execCommand('copy');input.remove();}notice('已复制。');}catch{notice('未能复制，请直接选中文本。');}}
function download(name,text,type='text/plain'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function closeDialog(){$('#dialog-root').innerHTML='';$('#search')?.focus();}
function openSearch(){
  $('#dialog-root').innerHTML=`<div class="dialog-backdrop"><section class="dialog" role="dialog" aria-modal="true" aria-label="搜索正文"><button class="dialog-close" aria-label="关闭搜索">×</button><h2>搜索正文</h2><label for="search-input" class="sr-only">关键词</label><input id="search-input" type="search" placeholder="例如：重试、权限、引用…"><div id="search-results"></div></section></div>`;
  const input=$('#search-input');input.focus();$('.dialog-close').onclick=closeDialog;$('.dialog-backdrop').onclick=e=>{if(e.target.classList.contains('dialog-backdrop'))closeDialog();};
  $('.dialog').onkeydown=e=>{if(e.key==='Tab'){const nodes=$$('button,input,a',$('.dialog'));if(e.shiftKey&&document.activeElement===nodes[0]){e.preventDefault();nodes.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===nodes.at(-1)){e.preventDefault();nodes[0].focus();}}};
  const paint=()=>{const q=input.value.trim().toLowerCase();const rows=course.chapters.filter(ch=>!q||JSON.stringify(ch).toLowerCase().includes(q));$('#search-results').innerHTML=rows.map(ch=>`<a href="#${ch.id}"><span>${ch.id}</span><div><strong>${esc(ch.title)}</strong><small>${esc(ch.deck)}</small></div>→</a>`).join('')||'<p class="empty">没有找到。换个词试试。</p>';$$('#search-results a').forEach(a=>a.onclick=closeDialog);};input.oninput=paint;paint();
}

async function boot(){
  try{
    const read=async path=>{const response=await fetch(file(`data/${path}`));if(!response.ok)throw new Error(`${path} 返回 ${response.status}`);return response.json();};
    [course,experiments,agents,reviewLog]=await Promise.all([read('course.json'),read('experiments.json'),read('agents.json'),read('review-log.json')]);
    state=loadState(storage,course.chapters.map(ch=>ch.id));shell();route();
  }catch(error){$('#app').innerHTML=`<main class="loading"><h1>课程暂时没有加载成功</h1><p>${esc(error.message)}</p><button class="button" id="reload">重新加载</button></main>`;$('#reload').onclick=()=>location.reload();}
}
window.addEventListener('hashchange',route);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeNav();if($('#dialog-root').childElementCount)closeDialog();}if(e.key==='/'&&course&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();openSearch();}});
boot();
