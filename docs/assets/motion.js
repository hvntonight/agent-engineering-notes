import {createScene,sceneCatalog} from './motion-data.js';

const mounted=new Set();
let serial=0;
const $=(s,r)=>r.querySelector(s);
const $$=(s,r)=>[...r.querySelectorAll(s)];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=value=>Number(value).toLocaleString('en-US');
const icons={play:'<path d="m8 5 11 7-11 7z"/>',pause:'<path d="M8 5v14M16 5v14"/>',back:'<path d="m14 5-7 7 7 7"/>',next:'<path d="m10 5 7 7-7 7"/>',reset:'<path d="M4 11a8 8 0 1 1 2 6M4 4v7h7"/>',expand:'<path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5"/>'};
const icon=name=>`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;

export function disposeMotions(){for(const player of [...mounted])player.dispose();}

function graphPath(from,to){
  const a={x:from.x+from.width/2,y:from.y+from.height/2};
  const b={x:to.x+to.width/2,y:to.y+to.height/2};
  if(Math.abs(a.y-b.y)<12){
    const sign=b.x>a.x?1:-1;
    a.x+=sign*from.width/2;b.x-=sign*to.width/2;
    return `M${a.x},${a.y} C${(a.x+b.x)/2},${a.y} ${(a.x+b.x)/2},${b.y} ${b.x},${b.y}`;
  }
  const sign=b.y>a.y?1:-1;
  a.y+=sign*from.height/2;b.y-=sign*to.height/2;
  const middle=(a.y+b.y)/2;
  return `M${a.x},${a.y} C${a.x},${middle} ${b.x},${middle} ${b.x},${b.y}`;
}

/** Mount a finite, user-started timeline. No network, model calls, or background loops. */
export function mountMotion(id,host,ctx,{embedded=false}={}){
  const uid=`motion-${++serial}`;
  let scene,options={},frame=0,playing=false,elapsed=0,previousTime=0,raf=0,speed=1,selected='',disposed=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  host.classList.add('motion-host');
  host.innerHTML=`<section class="motion-player" aria-label="${esc(sceneCatalog.find(s=>s.id===id)?.title)}动画" data-embedded="${embedded}" data-playing="false" data-motion-id="${id}" tabindex="0">
    <header class="motion-top"><div><span class="motion-dot"></span><span class="motion-series">ANATOMY OF AN AGENT</span><span class="motion-chapter">${id} / 08</span></div><div class="motion-top-actions">${embedded?`<a href="#animations/${id}" aria-label="在动画课堂放大查看本节">放大查看 ↗</a>`:''}<button data-motion-fullscreen aria-label="全屏观看动画">${icon('expand')}</button></div></header>
    <div class="motion-title"><div><p class="motion-eyebrow">${esc(sceneCatalog.find(s=>s.id===id)?.short)}</p><h2>${esc(sceneCatalog.find(s=>s.id===id)?.title)}</h2></div><span class="motion-kind"></span></div>
    <div class="motion-options"></div>
    <div class="motion-layout"><div class="motion-visual"><div class="motion-map-label"><span>架构与数据流</span><span>点击节点查看职责</span></div><div class="motion-graph" role="group" aria-label="可交互的架构节点"></div><div class="motion-route"></div><div class="motion-inspector" aria-live="polite"></div><div class="motion-measurements"></div></div>
      <aside class="motion-explanation"><div class="motion-step-label"><span>当前步骤</span><span class="motion-counter"></span></div><h3 class="motion-current-title"></h3><p class="motion-current-text"></p><div class="motion-todo"><span>你来做这一步</span><p></p></div><div class="motion-code"><div class="motion-code-label"></div><pre></pre></div></aside></div>
    <div class="motion-transport"><button data-motion-toggle class="motion-play" aria-label="播放动画">${icon('play')}<span>播放</span></button><button data-motion-reset aria-label="从头重播">${icon('reset')}</button><button data-motion-back aria-label="动画上一步">${icon('back')}</button><button data-motion-next aria-label="动画下一步">${icon('next')}</button><label class="motion-scrub"><span class="sr-only">动画步骤进度</span><input type="range" min="0" value="0" step="1" data-motion-seek aria-label="动画步骤进度"></label><span class="motion-position"></span><label class="motion-speed"><span class="sr-only">播放速度</span><select data-motion-speed aria-label="播放速度"><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label></div>
    <div class="motion-timeline" role="group" aria-label="选择一个动画步骤"></div>
    <details class="motion-evidence"><summary>本步的数据与依据</summary><pre></pre><div class="motion-file"></div></details>
    <p class="motion-footnote"></p><div class="motion-announcement sr-only" aria-live="polite"></div>
  </section>`;
  const root=$('.motion-player',host),graph=$('.motion-graph',root);
  const at=selector=>$(selector,root);
  // Keep transport visible before the long diagrams, especially on phones.
  root.insertBefore(at('.motion-transport'),at('.motion-layout'));
  let resizeObserver,intersectionObserver;

  function pause(){
    playing=false;cancelAnimationFrame(raf);raf=0;previousTime=0;
    root.dataset.playing='false';
    at('[data-motion-toggle]').innerHTML=icon('play')+'<span>播放</span>';
    at('[data-motion-toggle]').setAttribute('aria-label',frame===scene?.frames.length-1?'从头播放动画':'播放动画');
  }

  function positionParticles(progress=.5){
    const paths=$$('path.motion-edge.is-current',graph);
    $$('circle.motion-particle',graph).forEach((circle,i)=>{
      const path=paths[i];
      if(!path){circle.style.display='none';return;}
      const length=path.getTotalLength();
      if(!length){circle.style.display='none';return;}
      const point=path.getPointAtLength(length*((progress+i*.19)%1));
      circle.setAttribute('cx',point.x);circle.setAttribute('cy',point.y);circle.style.display='';
    });
  }

  function drawEdges(){
    if(disposed||!host.isConnected)return;
    const layout=root.clientWidth>900?'wide':root.clientWidth>560?'medium':'narrow';
    if(root.dataset.layout!==layout)root.dataset.layout=layout;
    const box=graph.getBoundingClientRect(),svg=$('svg.motion-wires',graph);
    if(!box.width||!box.height||!svg)return;
    svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);
    const positions={};
    $$('[data-motion-node]',graph).forEach(button=>{const b=button.getBoundingClientRect();positions[button.dataset.motionNode]={x:b.left-box.left,y:b.top-box.top,width:b.width,height:b.height};});
    for(const edge of scene.edges){
      const path=svg.querySelector(`[data-edge="${edge.id}"]`);
      if(path&&positions[edge.from]&&positions[edge.to])path.setAttribute('d',graphPath(positions[edge.from],positions[edge.to]));
    }
    positionParticles(playing&&!reduced.matches?(elapsed/3200)%1:.5);
  }

  function inspectNode(id){
    selected=id;const data=scene.nodes.find(n=>n.id===id);
    $$('[data-motion-node]',graph).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.motionNode===id)));
    const source=scene.sources?.find(s=>s.id===data?.source);
    at('.motion-inspector').innerHTML=data?`<strong>${esc(data.title)}</strong><p>${esc(data.detail)}</p>${source?`<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">直接来源：${esc(source.title)} ↗</a>`:''}`:'<span>图中的亮线表示当前数据流；点一个节点，查看它的职责。</span>';
  }

  function measurements(){
    if(scene.comparison){
      const {full,retrieval}=scene.comparison,max=Math.max(full.input_tokens,retrieval.input_tokens);
      at('.motion-measurements').innerHTML=`<div class="motion-meter-title">真实累计输入 <span>token / 整个任务</span></div>${[[full,'全文'],[retrieval,'检索']].map(([r,label],i)=>`<div class="motion-meter ${i?'retrieval':''}"><span>${label}</span><div aria-hidden="true"><i style="width:${r.input_tokens/max*100}%"></i></div><strong>${format(r.input_tokens)}</strong><small>${r.model_calls} 次 · ${r.elapsed_s.toFixed(2)} 秒</small></div>`).join('')}`;
    }else if(scene.summary){
      at('.motion-measurements').innerHTML=`<div class="motion-results">${scene.summary.map((r,i)=>`<div><span>${['单次','工具','工具＋检查'][i]}</span><strong>${r.passed}<small> / ${r.total}</small></strong><span>${r.model_calls} 次决策</span></div>`).join('')}</div>`;
    }else at('.motion-measurements').innerHTML='';
  }

  function configure(){
    scene=createScene(id,options,ctx);frame=0;elapsed=0;selected='';
    at('.motion-kind').textContent=scene.label;
    at('.motion-options').innerHTML=(scene.options||[]).map(option=>`<label><span>${esc(option.label)}</span><select data-motion-option="${option.key}" aria-label="${esc(option.label)}">${option.items.map(([key,label])=>`<option value="${key}" ${key===option.value?'selected':''}>${esc(label)}</option>`).join('')}</select></label>`).join('');
    graph.innerHTML=`<svg class="motion-wires" aria-hidden="true" preserveAspectRatio="none"><defs><marker id="${uid}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke"/></marker></defs>${scene.edges.map(edge=>`<path data-edge="${edge.id}" class="motion-edge" fill="none" marker-end="url(#${uid}-arrow)"/>`).join('')}${Array.from({length:4},()=>'<circle class="motion-particle" r="4.5"/>').join('')}</svg>${scene.nodes.map(n=>`<button type="button" class="motion-node" data-motion-node="${n.id}" aria-pressed="false"><span class="motion-node-tag">${esc(n.tag)}</span><strong>${esc(n.title)}</strong><span class="motion-node-state"></span></button>`).join('')}`;
    at('.motion-code-label').textContent=scene.codeLabel||'控制结构示意 · 高亮对应本步';
    at('.motion-code pre').innerHTML=scene.code.map((line,i)=>`<span data-code-line="${i}"><i>${String(i+1).padStart(2,'0')}</i><code>${esc(line)}</code></span>`).join('');
    at('.motion-timeline').innerHTML=scene.frames.map((f,i)=>`<button data-motion-frame="${i}" aria-label="第 ${i+1} 步：${esc(f.title)}"><span>${String(i+1).padStart(2,'0')}</span>${esc(f.title)}</button>`).join('');
    at('[data-motion-seek]').max=scene.frames.length-1;
    at('.motion-footnote').textContent=scene.note+(reduced.matches?' 已按系统偏好减少移动效果。':'');
    at('.motion-file').innerHTML=scene.file?`<a href="${ctx.file(`lab/${scene.file}`)}" target="_blank" rel="noopener noreferrer">对照实验包的完整文件：${esc(scene.file)} ↗</a>`:'';
    inspectNode('');measurements();paint();drawEdges();
  }

  function paint(){
    if(disposed)return;
    const current=scene.frames[frame];
    const visited=new Set(scene.frames.slice(0,frame).flatMap(f=>f.active));
    const states=Object.assign({},...scene.frames.slice(0,frame+1).map(f=>f.states||{}));
    $$('[data-motion-node]',graph).forEach(button=>{
      const id=button.dataset.motionNode;
      button.classList.toggle('is-active',current.active.includes(id));
      button.classList.toggle('is-visited',visited.has(id));
      button.classList.toggle('is-error',(current.bad||[]).includes(id));
      button.classList.toggle('is-stale',(current.stale||[]).includes(id));
      const label=states[id]||'';
      $('.motion-node-state',button).textContent=(current.stale||[]).includes(id)?`${label.split(' · ')[0]} · 待复算`:label||(current.active.includes(id)?'当前步骤':'');
    });
    $$('path.motion-edge',graph).forEach(path=>path.classList.toggle('is-current',current.edges.includes(path.dataset.edge)));
    at('.motion-current-title').textContent=current.title;
    at('.motion-current-text').textContent=current.text;
    at('.motion-todo p').textContent=current.todo;
    at('.motion-counter').textContent=`${String(frame+1).padStart(2,'0')} / ${String(scene.frames.length).padStart(2,'0')}`;
    at('.motion-position').textContent=`${frame+1}/${scene.frames.length}`;
    at('[data-motion-seek]').value=frame;
    at('[data-motion-seek]').setAttribute('aria-valuetext',`第 ${frame+1} 步，${current.title}`);
    at('[data-motion-back]').disabled=frame===0;
    at('[data-motion-next]').disabled=frame===scene.frames.length-1;
    $$('[data-motion-frame]',root).forEach(button=>{const active=Number(button.dataset.motionFrame)===frame;button.classList.toggle('is-current',active);button.setAttribute('aria-pressed',String(active));});
    $$('[data-code-line]',root).forEach(line=>line.classList.toggle('is-current',Number(line.dataset.codeLine)===current.line));
    at('.motion-evidence pre').textContent=JSON.stringify(current.payload,null,2);
    const flow=current.edges.map(key=>scene.edges.find(e=>e.id===key)).filter(Boolean);
    at('.motion-route').innerHTML=flow.length?`<span class="motion-route-label">本步流向</span>${flow.map(e=>`<span>${esc(scene.nodes.find(n=>n.id===e.from).title)} <b>→</b> ${esc(scene.nodes.find(n=>n.id===e.to).title)} <small>${esc(e.label)}</small></span>`).join('')}`:'<span class="motion-route-label">状态检查</span><span>暂停观察当前节点；下一步将沿亮线传递数据。</span>';
    if(!playing)at('.motion-announcement').textContent=`第 ${frame+1} 步。${current.title}。${current.text}`;
    positionParticles(.5);
    root.dataset.frame=frame;
    root.style.setProperty('--motion-progress','0%');
  }

  function seek(target){pause();frame=Math.max(0,Math.min(scene.frames.length-1,target));elapsed=0;paint();}
  function tick(time){
    if(!playing||disposed)return;
    if(!host.isConnected||document.hidden){pause();return;}
    if(previousTime)elapsed+=Math.min(100,time-previousTime)*speed;
    previousTime=time;
    root.style.setProperty('--motion-progress',`${Math.min(100,elapsed/3800*100)}%`);
    if(!reduced.matches)positionParticles((elapsed/1600)%1);
    if(elapsed>=3800){
      if(frame===scene.frames.length-1){pause();paint();return;}
      frame++;elapsed=0;paint();
    }
    raf=requestAnimationFrame(tick);
  }
  function play(){
    if(playing){pause();paint();return;}
    // Only one timeline can play at a time, including embedded course players.
    for(const player of mounted)player.pause();
    if(frame===scene.frames.length-1){frame=0;elapsed=0;paint();}
    playing=true;previousTime=0;root.dataset.playing='true';
    at('[data-motion-toggle]').innerHTML=icon('pause')+'<span>暂停</span>';
    at('[data-motion-toggle]').setAttribute('aria-label','暂停动画');
    raf=requestAnimationFrame(tick);
  }

  function click(event){
    const control=event.target.closest('button');if(!control)return;
    if(control.hasAttribute('data-motion-toggle'))play();
    else if(control.hasAttribute('data-motion-next'))seek(frame+1);
    else if(control.hasAttribute('data-motion-back'))seek(frame-1);
    else if(control.hasAttribute('data-motion-reset'))seek(0);
    else if(control.hasAttribute('data-motion-frame'))seek(Number(control.dataset.motionFrame));
    else if(control.hasAttribute('data-motion-node'))inspectNode(control.dataset.motionNode);
    else if(control.hasAttribute('data-motion-fullscreen')){
      const action=document.fullscreenElement===root?document.exitFullscreen():root.requestFullscreen?.();
      action?.catch(()=>ctx.notice?.('浏览器未能进入全屏，可使用动画课堂查看。'));
    }
  }
  root.addEventListener('click',click);
  at('[data-motion-seek]').addEventListener('input',event=>seek(Number(event.target.value)));
  at('[data-motion-speed]').addEventListener('change',event=>{speed=Number(event.target.value);});
  at('.motion-options').addEventListener('change',event=>{
    const key=event.target.dataset.motionOption;if(!key)return;
    pause();options[key]=event.target.value;configure();
    at(`[data-motion-option="${key}"]`)?.focus({preventScroll:true});
  });
  root.addEventListener('keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.target.closest('input,textarea,select,summary,a'))return;
    if(event.key==='ArrowRight'){event.preventDefault();seek(frame+1);}
    else if(event.key==='ArrowLeft'){event.preventDefault();seek(frame-1);}
    else if(event.key===' '&&event.target===root){event.preventDefault();play();}
  });
  const onVisibility=()=>{if(document.hidden)pause();};
  const onReduced=()=>{pause();if(scene)at('.motion-footnote').textContent=scene.note+(reduced.matches?' 已按系统偏好减少移动效果。':'');};
  const onFullscreen=()=>{at('[data-motion-fullscreen]').setAttribute('aria-label',document.fullscreenElement===root?'退出全屏':'全屏观看动画');drawEdges();};
  document.addEventListener('visibilitychange',onVisibility);
  document.addEventListener('fullscreenchange',onFullscreen);
  reduced.addEventListener('change',onReduced);
  const controller={pause,dispose(){if(disposed)return;pause();disposed=true;resizeObserver?.disconnect();intersectionObserver?.disconnect();document.removeEventListener('visibilitychange',onVisibility);document.removeEventListener('fullscreenchange',onFullscreen);reduced.removeEventListener('change',onReduced);mounted.delete(controller);}};
  mounted.add(controller);
  if(!root.requestFullscreen)at('[data-motion-fullscreen]').hidden=true;
  configure();
  resizeObserver=new ResizeObserver(drawEdges);resizeObserver.observe(graph);resizeObserver.observe(root);
  intersectionObserver=new IntersectionObserver(entries=>{if(entries[0]&&!entries[0].isIntersecting)pause();},{threshold:0});
  intersectionObserver.observe(root);
  return controller;
}

export function mountAnimationPage(main,ctx,id='01'){
  const selected=sceneCatalog.some(s=>s.id===id)?id:'01';
  main.innerHTML=`<header class="chapter-header animation-heading"><div><p class="kicker">动画课堂 · 可暂停，可逐步回看</p><h1>把一次任务慢放</h1><p>沿着亮线看数据怎样流动。点节点看职责，再把当前步骤对照到程序。</p></div><a class="button" href="#${selected}">读本节正文 ↗</a></header><nav class="motion-catalog" aria-label="选择动画章节">${sceneCatalog.map(s=>`<a href="#animations/${s.id}" ${s.id===selected?'aria-current="page"':''}><span>${s.id}</span>${esc(s.short)}</a>`).join('')}</nav><div id="animation-stage"></div><section class="motion-reading"><div><span class="kicker">怎么看</span><h2>先看一遍，再停在有疑问的地方</h2><p>点「播放」顺着过程看，也可以点时间轴、拖动进度或用左右键逐步查看。切换公式、资料规模和更新策略，观察不同路径。</p></div><div><span class="kicker">关于这些动画</span><p>机制演示在本页运行；真实轨迹与测量读取课件已有记录。架构图是公开文档的教学抽象，不能当作完整内部实现。</p><a href="#experiments">打开真实实验记录 →</a></div></section><details class="motion-reference"><summary>动画的设计参考与实现方式</summary><p>图、步骤、代码与数据使用同一个时间轴。使用 SVG 与 JavaScript 绘制，可逐步回看；播放器不会调用模型。</p><ul>${(ctx.course.motion_readings||[]).map(r=>`<li><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.title)} ↗</a><p>${esc(r.borrow)}</p></li>`).join('')}</ul></details>`;
  mountMotion(selected,$('#animation-stage',main),ctx);
}
