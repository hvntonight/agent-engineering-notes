import {calculate,sameNumber} from './math.js';
const $=(s,r)=>r.querySelector(s);
const $$=(s,r)=>[...r.querySelectorAll(s)];
const number=n=>Number(n||0).toLocaleString('en-US');
const label={direct:'单次回答',tools:'允许工具',checked:'工具＋证据门'};
const tasks={'math-small':'小算术','math-large':'长整数乘法','math-inventory':'库存核对','docs-effective-policy':'有效政策','docs-multihop':'发布资料追踪','docs-missing':'证据不足'};

function title(text,kind){return `<div class="lab-title"><h3>${text}</h3><span>${kind}</span></div>`;}
function contextHint(text){return `<p class="lab-caption">${text}</p>`;}

export function mountLab(name,node,ctx){
  const preserveFocus=event=>{
    const active=event.target.closest('button,select,input');
    if(!active||document.contains(active))return;
    const attr=active.id?'id':active.getAttributeNames().find(name=>name.startsWith('data-'));
    if(!attr)return;
    const selector=`[${attr}="${CSS.escape(active.getAttribute(attr))}"]`;
    const replacement=node.querySelector(selector);
    const target=replacement&&!replacement.disabled?replacement:node.querySelector('.controls button:not(:disabled),button:not(:disabled),select,input');
    target?.focus({preventScroll:true});
  };
  node.addEventListener('click',preserveFocus);
  node.addEventListener('change',preserveFocus);
  const render={loop,calculator,recovery,reconnect,context,verification,implementations,evaluation,project,invalidation,replay};
  if(render[name])render[name](node,ctx);
}

function loop(node,{esc}){
  let fault=false,index=0;
  const normal=[
    {action:{action:'read',argument:'inventory-current'},observation:{ok:true,id:'inventory-current',text:'411 箱 × 152；发出 11260；可售退货 708；报损 152。'}},
    {action:{action:'calculate',argument:'411*152-11260+708-152'},observation:{ok:true,id:'calc:1',value:'51768'}},
    {action:{action:'finish',answer:'51768',citations:['calc:1']}}
  ];
  const paint=()=>{const steps=fault?[normal[0],{action:normal[1].action,observation:{ok:false,error:'TEMPORARY_UNAVAILABLE',retryable:true}},...normal.slice(1)]:normal;index=Math.min(index,steps.length-1);node.innerHTML=title('逐步查看循环','确定性演示 · 0 次模型调用')+`<div class="lab-toolbar"><div class="segments"><button data-fault="false" aria-pressed="${!fault}">正常路径</button><button data-fault="true" aria-pressed="${fault}">计算器先失败一次</button></div><span>${index+1} / ${steps.length}</span></div><div class="step-list">${steps.map((s,i)=>`<button data-step="${i}" class="${i===index?'selected':''}"><span>${i+1}</span>${esc(s.action.action)}${s.observation?.ok===false?' · 失败':''}</button>`).join('')}</div><pre class="console">${esc(JSON.stringify(steps[index],null,2))}</pre><div class="controls"><button data-reset class="button">回到开头</button><button data-next class="button primary" ${index===steps.length-1?'disabled':''}>下一步 →</button></div>`+contextHint('这是测试策略的固定路径，用来理解控制流。真实模型可以选择不同动作，不能把这次演示算成模型成绩。');
  $$('[data-fault]',node).forEach(b=>b.onclick=()=>{fault=b.dataset.fault==='true';index=0;paint();});$$('[data-step]',node).forEach(b=>b.onclick=()=>{index=+b.dataset.step;paint();});$('[data-next]',node).onclick=()=>{index++;paint();};$('[data-reset]',node).onclick=()=>{index=0;paint();};};paint();
}

function calculator(node,{esc}){
  const examples=['0.1 + 0.2','411*152-11260+708-152','1 / 0',"__import__('os')"];
  node.innerHTML=title('直接试工具','浏览器内的精确运算')+`<div class="examples">${examples.map((s,i)=>`<button data-example="${i}">${esc(i===3?'一段函数调用':s)}</button>`).join('')}</div><form><label for="expression">表达式</label><div class="input-row"><input id="expression" value="0.1 + 0.2" maxlength="1500" autocomplete="off" spellcheck="false"><button class="button primary" type="submit">计算</button></div></form><div class="calculation-output" role="status">输入表达式，再运行一次。</div>`;
  $$('[data-example]',node).forEach(b=>b.onclick=()=>{$('#expression',node).value=examples[+b.dataset.example];});
  $('form',node).onsubmit=e=>{e.preventDefault();try{const result=calculate($('#expression',node).value);$('.calculation-output',node).innerHTML=`<span>返回值</span><strong>${esc(result)}</strong><p>精确计算完成。接下来仍要核对公式是否符合任务。</p>`;}catch(error){$('.calculation-output',node).innerHTML=`<span>工具错误</span><p>${esc(error.message)}</p>`;}};
}

function traceView(node,ctx,trials,fixed=false){
  const {esc}=ctx;let chosen=trials[0].id,step=0;
  const paint=()=>{const trial=trials.find(t=>t.id===chosen);node.innerHTML=title(fixed?'第一次失败之后':'查看一次任务','真实运行 · 2026-10-23')+
    (fixed?'':`<label for="trial-select">任务与条件</label><select id="trial-select">${trials.map(t=>`<option value="${esc(t.id)}" ${t.id===chosen?'selected':''}>${tasks[t.case_id]} / ${label[t.mode]} / ${t.run==='pilot-20261023'?'主对照':t.run.includes('recovery')?'注入故障':t.run.includes('1024')?'1028 份资料':'100 份资料'}</option>`).join('')}</select>`)+
    `<p class="trial-question">${esc(trial.question)}</p><div class="trial-metadata"><span>结束状态 ${esc(trial.status)}</span><span>${trial.elapsed_s.toFixed(2)} 秒</span><span>${trial.model_calls} 次模型决策</span></div><div class="step-list">${trial.trace.map((s,i)=>`<button data-step="${i}" class="${step===i?'selected':''}"><span>${i+1}</span>${esc(s.action.action)}${s.observation?.ok===false?' · 失败':''}</button>`).join('')}</div><pre class="console">${esc(JSON.stringify(trial.trace[step],null,2))}</pre><div class="controls"><button data-back class="button" ${step===0?'disabled':''}>← 上一步</button><button data-next class="button primary" ${step===trial.trace.length-1?'disabled':''}>下一步 →</button></div><details><summary>查看独立评分与用量</summary><pre>${esc(JSON.stringify({answer:trial.answer,grade:trial.grade,usage:trial.usage},null,2))}</pre></details>`+contextHint('问题、动作、工具观察和评分来自保存的记录。打开这里不会新跑模型。输入用量包含 Codex 后端提示等开销。');
  if(!fixed)$('#trial-select',node).onchange=e=>{chosen=e.target.value;step=0;paint();};$$('[data-step]',node).forEach(b=>b.onclick=()=>{step=+b.dataset.step;paint();});$('[data-back]',node).onclick=()=>{step--;paint();};$('[data-next]',node).onclick=()=>{step++;paint();};};paint();
}
function replay(node,ctx){traceView(node,ctx,ctx.experiments.trials);}
function recovery(node,ctx){traceView(node,ctx,ctx.experiments.trials.filter(t=>t.run==='recovery-20261023'),true);}

function reconnect(node,{esc}){
  const choices=[
    ['重新发送同样的出库请求','先确认工具是否支持稳定的幂等键，以及上次请求的状态。没有这些条件，重发可能重复出库。'],
    ['用 operation_id 查询状态','这是这里应先做的步骤。已完成就取回结果；未提交才考虑重发；仍未知时继续查询或停下交接。'],
    ['从最近的界面快照继续','快照可能比实际业务状态旧。应将界面快照与持久状态核对，不能只凭少了一条事件判断执行情况。']
  ];
  node.innerHTML=title('出库请求发出后，网络断了','恢复场景演示')+`<p>工具可能已经提交成功，只是响应没有到达。你下一步准备怎么做？</p><div class="choice-list">${choices.map((c,i)=>`<button data-choice="${i}">${esc(c[0])}<span>→</span></button>`).join('')}</div><div class="choice-feedback" aria-live="polite"></div>`;
  $$('[data-choice]',node).forEach(b=>b.onclick=()=>{$('.choice-feedback',node).innerHTML=`<p>${esc(choices[+b.dataset.choice][1])}</p>`;});
}

function context(node,ctx){
  const find=(run)=>ctx.experiments.trials.find(t=>t.case_id==='docs-multihop'&&t.mode==='tools'&&t.run===run);
  const values={100:[find('pilot-20261023'),find('retrieval-20261023')],1028:[find('context-full-1024-20261023'),find('context-indexed-1024-20261023')]};
  let size=100,metric='tokens';
  const get=t=>metric==='tokens'?t.usage.input_tokens:metric==='seconds'?t.elapsed_s:t.model_calls;
  const paint=()=>{const rows=values[size],max=Math.max(...rows.map(get));node.innerHTML=title('全文与检索，分别花在哪里','真实单题测量')+`<div class="lab-toolbar"><div class="segments">${[100,1028].map(n=>`<button data-size="${n}" aria-pressed="${size===n}">${number(n)} 份资料</button>`).join('')}</div><label>比较 <select id="metric"><option value="tokens" ${metric==='tokens'?'selected':''}>累计输入 token</option><option value="seconds" ${metric==='seconds'?'selected':''}>总耗时 / 秒</option><option value="calls" ${metric==='calls'?'selected':''}>模型调用次数</option></select></label></div><div class="bars" role="group" aria-label="全文与检索实测数据">${rows.map((r,i)=>`<div class="bar-row"><span>${i?'按需检索':'全文输入'}</span><div class="bar-track" aria-hidden="true"><div class="bar ${i?'retrieval':'full'}" style="width:${get(r)/max*100}%"></div></div><strong>${metric==='seconds'?get(r).toFixed(2):number(get(r))}</strong></div>`).join('')}</div><div class="comparison-reading"><strong>${size===100?'这一规模里，检索的累计输入更多。':'这一规模里，检索的累计输入更少，耗时仍更长。'}</strong><p>两个条件都通过任务与引用评分。${size===100?'每次读得少，不意味着全过程输入少。':'原始输入总量约减少 49.4%；这不是账单同比下降的测量。'}</p></div>`+contextHint('每个条件只测一次，任务是沿事件、运行手册与发布记录找到批准产物。干扰资料较简单，不代表完整长上下文测试。');
  $$('[data-size]',node).forEach(b=>b.onclick=()=>{size=+b.dataset.size;paint();});$('#metric',node).onchange=e=>{metric=e.target.value;paint();};};paint();
}

function verification(node,{esc}){
  const cases=[
    {label:'原条件，公式正确',formula:'411*152-11260+708-152',answer:'51768',status:'finished',cite:'calc:1'},
    {label:'把退货也减掉',formula:'411*152-11260-708-152',answer:'50352',status:'finished',cite:'calc:1'},
    {label:'数值正确，但没有完成',formula:'411*152-11260+708-152',answer:'51768',status:'time_budget_exhausted',cite:'calc:1'}
  ];let index=0;
  const paint=()=>{const c=cases[index],computed=calculate(c.formula),consistent=sameNumber(c.answer,computed),task=sameNumber(c.answer,'51768')&&c.status==='finished';node.innerHTML=title('对同一条结果，换三层检查','检查器的反例')+`<label for="verification-case">选择结果</label><select id="verification-case">${cases.map((c,i)=>`<option value="${i}" ${i===index?'selected':''}>${esc(c.label)}</option>`).join('')}</select><pre>${esc(JSON.stringify({expression:c.formula,tool_value:computed,answer:c.answer,citation:c.cite,status:c.status},null,2))}</pre><div class="check-results"><div><span>给定表达式是否精确算完</span><strong class="yes">通过</strong></div><div><span>答案是否与引用的计算一致</span><strong class="${consistent?'yes':'no'}">${consistent?'通过':'未通过'}</strong></div><div><span>是否满足这个库存任务的答案与结束条件</span><strong class="${task?'yes':'no'}">${task?'通过':'未通过'}</strong></div></div>`+contextHint('最后一项使用已知教学任务的外部评分规则。前两项检查没有证明公式符合业务含义。这里没有调用模型。');$('#verification-case',node).onchange=e=>{index=+e.target.value;paint();};};paint();
}

const tours={
  codex:{name:'Codex',question:'应用自己负责什么，运行时负责什么？',source:'公开协议与官方架构文档',steps:[
    ['先找集成入口','从 app-server 的 thread、turn、item 看会话、一次工作与执行条目如何分开。'],
    ['再找工具往返','工具活动与进度从事件流返回；客户端还需处理失败、中断和审批生命周期。'],
    ['带回项目','库存页面可以拥有业务资料与按钮，运行时拥有 Agent 循环。两边都要清楚完成状态由谁检查。']
  ],urls:['codex-protocol','codex-platform','codex-sandbox'],note:'审批决定动作如何获准；沙箱限制实际资源访问。两层不能互相代替。'},
  claude:{name:'Claude Code',question:'长期约定、临时过程和执行检查分别放在哪里？',source:'公开文档与 SDK 边界说明',steps:[
    ['先读工作循环','查获取上下文、行动与验证怎样连续发生。'],
    ['再读扩展职责','CLAUDE.md/记忆提供上下文，skills 装载过程知识，subagent 隔离子任务，hooks 接入生命周期。'],
    ['带回项目','把出库规则交给执行检查，把查资料的方法写成流程；不要期待一份自然语言说明强制隔离资源。']
  ],urls:['claude-loop','claude-memory','claude-hooks','claude-sandbox','claude-sdk'],note:'这里依据公开文档，不声称检查过全部内部实现。Hook 能否阻断，要看事件、处理器与失败策略。'},
  pi:{name:'Pi',question:'完整会话与发给模型的输入，是同一个东西吗？',source:'固定源码与公开实现文档',steps:[
    ['从循环入口走','看 AgentMessage 怎样经过 transformContext 和 convertToLlm 形成模型输入。'],
    ['再看会话树','JSONL 条目的 id/parentId 形成分支；压缩与分支摘要影响活动输入，原始条目仍保留。'],
    ['带回项目','保留来源与完整观察，同时按下一步任务选择输入。不要把磁盘中存在的信息当作模型已经知道。']
  ],urls:['pi-core','pi-session','pi-compaction','pi-security','pi-mcp'],note:'本次固定快照已内置 MCP。四个默认工具描述核心选择，不表示只有四种能力；项目信任也不是操作系统隔离。'},
  opencode:{name:'OpenCode V2',question:'浏览器断线后，哪些信息还能查回来？',source:'V2 文档与固定源码',steps:[
    ['先画客户端与服务端','客户端调用 HTTP API、订阅 SSE；服务端保存会话与执行状态。'],
    ['区分实时事件与历史','SSE 是易失的实时流，断线期间可能错过事件；持久消息与会话要另行查询。'],
    ['带回项目','为任务保留标识与持久状态，重连先查状态，再决定补结果还是继续。']
  ],urls:['oc-client','oc-api','oc-storage-code','oc-permissions','oc-agents'],note:'这里按 V2。Plan 仍可能写计划文件，shell 按权限规则执行；计划模式不等于通用沙箱。'}
};

function implementations(node,{agents,esc}){
  let chosen='codex';
  const paint=()=>{const t=tours[chosen],data=agents.find(a=>a.id===chosen);node.innerHTML=title('选一条路径跟读','文档事实与课程判断分开')+`<div class="implementation-tabs">${Object.entries(tours).map(([id,t])=>`<button data-agent="${id}" aria-pressed="${id===chosen}">${t.name}</button>`).join('')}</div><div class="implementation-intro"><h3>${esc(t.question)}</h3><p>${esc(t.source)}${data.repo_revision?` · <code>${esc(data.repo_revision.slice(0,12))}</code>`:' · 核实于 2026-10-23 UTC'}</p></div><ol class="tour-steps">${t.steps.map(([title,text])=>`<li><strong>${esc(title)}</strong><p>${esc(text)}</p></li>`).join('')}</ol><div class="source-links">${t.urls.map(id=>data.sources.find(s=>s.id===id)).filter(Boolean).map(s=>`<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`).join('')}</div><p class="lab-caption">${esc(t.note)}</p>`;$$('[data-agent]',node).forEach(b=>b.onclick=()=>{chosen=b.dataset.agent;paint();});};paint();
}

function evaluation(node,{experiments,esc}){
  const primary=experiments.trials.filter(t=>t.run==='pilot-20261023');
  let filter='all';
  const paint=()=>{const rows=primary.filter(t=>filter==='all'||t.case_id===filter);node.innerHTML=title('六道开发题的主对照','原始分母保留')+`<label for="task-filter">观察范围</label><select id="task-filter"><option value="all" ${filter==='all'?'selected':''}>全部六题</option>${Object.entries(tasks).map(([id,name])=>`<option value="${id}" ${filter===id?'selected':''}>${name}</option>`).join('')}</select><div class="table-scroll"><table><thead><tr><th>条件</th><th>任务通过</th><th>中位耗时 / 秒</th><th>模型调用</th><th>累计输入 token</th></tr></thead><tbody>${['direct','tools','checked'].map(mode=>{const part=rows.filter(t=>t.mode===mode),times=part.map(t=>t.elapsed_s).sort((a,b)=>a-b),middle=Math.floor(times.length/2),median=times.length%2?times[middle]:(times[middle-1]+times[middle])/2;return `<tr><td>${label[mode]}</td><td>${part.filter(t=>t.grade.task_success).length}/${part.length}</td><td>${median.toFixed(2)}</td><td>${part.reduce((s,t)=>s+t.model_calls,0)}</td><td>${number(part.reduce((s,t)=>s+t.usage.input_tokens,0))}</td></tr>`;}).join('')}</tbody></table></div><p>这组题在三个条件下都通过，无法体现准确率差异。切到单题，看看总体中位数没有告诉你的部分。</p>`+contextHint('模型请求为 gpt-6.1-sol / low，实验 CLI 为 0.164.0。direct 禁用原生工具且只答一次；循环组有多轮预算。这不是默认 Codex 产品与其他 Agent 的横向排名。');$('#task-filter',node).onchange=e=>{filter=e.target.value;paint();};};paint();
}

function invalidation(node,{esc}){
  let boxes=411,initial=62472,remaining=51768,dirty=true,fresh=true;
  const paint=()=>{node.innerHTML=title('一份修订单之后','依赖失效演示 · 不是模型成绩')+`<p>新的有效单据把箱数改为 400。其他条件不变。哪些结论需要重新算？</p><div class="dependency-chain"><div><span>有效箱数</span><strong>${boxes}</strong><small>当前来源</small></div><i>→</i><div class="${dirty&&!fresh?'stale':''}"><span>初始件数</span><strong>${number(initial)}</strong><small>${dirty&&!fresh?'待复算':'当前值'}</small></div><i>→</i><div class="${dirty?'stale':''}"><span>可售库存</span><strong>${number(remaining)}</strong><small>${dirty?'待复算':'当前值'}</small></div></div><div class="controls wrap"><button class="button" data-update ${boxes===400?'disabled':''}>应用修订单</button><button class="button" data-initial ${boxes!==400||fresh?'disabled':''}>复算初始件数</button><button class="button primary" data-remaining ${boxes!==400||!fresh||!dirty?'disabled':''}>复算可售库存</button></div>`;
  $('[data-update]',node).onclick=()=>{boxes=400;dirty=true;fresh=false;paint();};$('[data-initial]',node).onclick=()=>{initial=boxes*152;fresh=true;paint();};$('[data-remaining]',node).onclick=()=>{remaining=initial-11260+708-152;dirty=false;paint();};};dirty=false;paint();
}

function project(node,ctx){
  const {esc,download}=ctx;
  node.innerHTML=title('写一张自己的实验单','生成计划，不预测成绩')+`<form class="project-form"><label for="project-task">准备解决的具体任务</label><input id="project-task" maxlength="300" value="核对带修订单的可售库存"><label for="project-change">本次只改什么</label><textarea id="project-change" rows="2" maxlength="1000" placeholder="例如：来源更新后，让依赖旧数量的计算失效。"></textarea><label for="project-baseline">主要比较对象</label><select id="project-baseline"><option>固定工作流</option><option>不复核的 Agent</option><option>全量复核的 Agent</option></select><div class="form-grid"><label>每题重复次数<input id="project-repeats" type="number" min="1" max="20" value="3"></label><label>每题决策上限<input id="project-steps" type="number" min="2" max="30" value="6"></label></div><label for="project-against">什么结果会让你放弃这项改动</label><textarea id="project-against" rows="2" maxlength="1000" placeholder="例如：漏失效让严格成功率下降，节省的用量不足以抵消维护成本。"></textarea><button class="button primary" type="submit">生成实验单</button></form><div class="project-output" aria-live="polite"></div><details><summary>先看一遍失效传播的示意</summary><div class="nested-lab" id="invalidation-demo"></div></details>`;
  invalidation($('#invalidation-demo',node),ctx);
  $('.project-form',node).onsubmit=e=>{e.preventDefault();const change=$('#project-change',node).value.trim(),against=$('#project-against',node).value.trim();if(!change||!against){$('.project-output',node).innerHTML='<p>补上本次改动与反对证据，计划才有可检验的条件。</p>';return;}
    const plan={task:$('#project-task',node).value,change,baseline:$('#project-baseline',node).value,repeats:+$('#project-repeats',node).value,max_steps:+$('#project-steps',node).value,evidence_against:against,metrics:['严格任务成功率','结束状态','累计用量','总耗时'],dataset_split:'开发题 / 冻结保留题',status:'plan_not_measured'};
    $('.project-output',node).innerHTML=`<pre>${esc(JSON.stringify(plan,null,2))}</pre><button class="button" data-export>下载实验单 JSON</button>`;$('[data-export]',node).onclick=()=>download('agent-experiment-plan.json',JSON.stringify(plan,null,2),'application/json');};
}
