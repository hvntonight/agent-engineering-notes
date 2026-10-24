import {calculate, sameNumber} from './math.js';

// These are observable events and teaching states, never a model's private reasoning.
export const sceneCatalog = [
  {id:'01', title:'一次任务怎样转起来', short:'任务循环', question:'模型提出动作之后，是谁真的把它执行了？', kind:'机制演示'},
  {id:'02', title:'把计算交给工具', short:'工具边界', question:'精确算完一个公式，为什么仍可能答错？', kind:'机制演示'},
  {id:'03', title:'沿着一次失败往下看', short:'故障恢复', question:'错误怎样回到下一轮，预算又在哪里耗尽？', kind:'真实轨迹'},
  {id:'04', title:'全文与检索的两条路', short:'上下文', question:'读的正文变少，累计输入为什么反而可能更多？', kind:'真实测量'},
  {id:'05', title:'让答案经过三道检查', short:'验证', question:'哪一层检查，能抓住哪一种错误？', kind:'机制演示'},
  {id:'06', title:'拆开四个 Agent 的架构', short:'架构走读', question:'把同一个问题，放到四种公开实现里看。', kind:'文档走读'},
  {id:'07', title:'把改动放进对照实验', short:'评测', question:'三组都得满分时，我们究竟学到了什么？', kind:'真实测量'},
  {id:'08', title:'一份修订单怎样传下去', short:'状态失效', question:'来源已经更新，旧计算为什么还会留下来？', kind:'机制演示'}
];

const node=(id,title,tag,detail,source='')=>({id,title,tag,detail,source});
const edge=(from,to,label)=>({id:`${from}:${to}`,from,to,label});
const step=(title,active,edges,text,todo,payload,line,extra={})=>({title,active,edges,text,todo,payload,line,...extra});
const values=n=>Number(n).toLocaleString('en-US');
const inventory='411*152-11260+708-152';
const baseNodes=()=>[
  node('task','任务与资料','INPUT','输入构造只接收问题和资料。外部评分答案不进入模型。'),
  node('model','决策后端','MODEL','返回一个动作。模型输出与真正执行工具是两个步骤。'),
  node('dispatch','动作分派','HARNESS','本地程序检查动作名、参数与预算，再调用对应工具。'),
  node('history','观察记录','STATE','保存实际动作与返回值，供下一轮构造输入。'),
  node('tool','读取 / 计算','TOOL','由普通代码执行。工具也可能返回错误。'),
  node('finish','提交结果','OUTPUT','只有提交 finish，循环才以完成状态结束。')
];

function loopScene(){
  return {nodes:baseNodes(),edges:[edge('task','model','构造输入'),edge('model','dispatch','动作 JSON'),edge('dispatch','tool','执行'),edge('tool','history','工具观察'),edge('history','model','下一轮输入'),edge('dispatch','finish','finish')],
    label:'固定测试策略 · 0 次模型调用', note:'用下载包的正常路径讲控制流；动画秒数不表示模型耗时，也不展示模型内部推理。', file:'agent_lab/agent.py',
    code:['task = public_input(question, documents)','action = backend.step(task, history)','observation = world.call(action)','history.append((action, observation))','action = backend.step(task, history)','return finish(action)'],
    frames:[
      step('准备资料',['task'],[],'先把库存单交给循环，评分标签留在循环之外。','打开 run.py，找到只允许 question 和 documents 进入模型的代码。',{question:'核对可售库存',documents:['inventory-current'],model_calls:0},0),
      step('提出读取动作',['model','dispatch'],['task:model','model:dispatch'],'测试策略返回 read。此时还没有读取工具的返回值。','让后端只返回结构化动作；不要在解析时顺便执行它。',{action:'read',argument:'inventory-current'},1),
      step('执行读取',['dispatch','tool'],['dispatch:tool'],'分派器调用读取函数，拿到实际资料。','在工具执行入口校验动作名与参数。',{ok:true,id:'inventory-current',text:'411 箱 × 152；发出 11260；可售退货 708；报损 152。'},2),
      step('把观察带回下一轮',['history','model'],['tool:history','history:model'],'工具返回形成一条观察，后端才有依据继续选动作。','把动作和观察一起保留，错误也要写进历史。',{history_entries:1,next_action:'calculate'},3),
      step('执行精确计算',['dispatch','tool'],['model:dispatch','dispatch:tool'],'这一轮的动作是 calculate。普通代码执行表达式，得到 51768。','单独测试 tools.py 的计算器，再把它接回循环。',{expression:inventory,ok:true,id:'calc:1',value:calculate(inventory)},2),
      step('用观察生成提交动作',['history','model'],['tool:history','history:model'],'下一轮能看到成功的计算及引用标识。测试策略现在提出 finish。','检查它引用的是本次观察到的 calc:1。',{action:'finish',answer:'51768',citations:['calc:1'],decision_steps:3},4),
      step('明确结束',['finish'],['model:dispatch','dispatch:finish'],'执行器识别 finish，返回 finished。工具算完与任务完成在这里汇合。','在结果里保留结束状态，不要从最后一句文字推断成功。',{status:'finished',answer:'51768',model_calls:0,decision_steps:3},5,{states:{finish:'finished · 51768'}})
    ]};
}

function toolScene(options){
  const wrong=options.formula==='wrong', expression=wrong?'411*152-11260-708-152':inventory, result=calculate(expression);
  return {nodes:[node('request','库存问题','TASK','业务语义规定可售退货应加回库存。'),node('formula','选择公式','DECISION','选择表达式时可能发生理解错误。'),node('schema','参数与语法','CONTRACT','形状检查不证明公式符合题意。'),node('score','独立任务评分','EVAL','用题目答案和完成条件检查整个任务。'),node('result','精确返回值','OBSERVATION','执行器保留表达式、值和调用引用。'),node('calculate','普通计算函数','TOOL','受限四则运算，无网络、无业务写入。')],
    edges:[edge('request','formula','理解任务'),edge('formula','schema','expression'),edge('schema','calculate','执行参数'),edge('calculate','result','精确结果'),edge('result','score','外部验收')],
    options:[{key:'formula',label:'公式',items:[['correct','退货加回'],['wrong','把退货也减掉']],value:wrong?'wrong':'correct'}],
    label:'本地精确运算 · 0 次模型调用',note:'切换公式只改变机制演示；没有调用模型。工具成功与任务成功分别检查。',file:'agent_lab/tools.py',
    code:['expression = choose_expression(question)','validate_action(name, argument)','value = exact_calculate(expression)','observation = {"id": "calc:1", "value": value}','task_success = grade(expected, answer, status)'],
    frames:[
      step('先读业务条件',['request'],[],'库存单说的是可售退货：这 708 件应该回到库存里。','先用独立计算写下正确答案 51768。',{returned_sellable:708,expected:'51768'},0),
      step('选出一个表达式',['formula'],['request:formula'],wrong?'这里故意把退货写成减项。表达式合法，业务含义却变了。':'把初始库存、发出、退货和报损组合成表达式。','切到另一种公式，观察后面的哪一层会拒绝它。',{expression},0,{states:{formula:wrong?'退货写成减项':'退货写成加项'}}),
      step('检查参数边界',['schema'],['formula:schema'],'只接受允许的运算符、有限长度的数字与括号。两种公式都能通过语法检查。','用除零、函数调用和超长输入试工具边界。',{syntax_valid:true,meaning_checked:false},1),
      step('由工具实际运算',['calculate'],['schema:calculate'],'代码按照给定公式计算。它不负责重新解释退货条件。','把表达式直接送进普通函数，隔离工具实现的问题。',{expression,value:result},2),
      step('保存返回值与引用',['result'],['calculate:result'],'准确的返回值和 calc:1 一起进入历史，后面可以核对答案有没有抄错。','同时保存表达式与值；只保存一个数字会丢掉检查依据。',{ok:true,id:'calc:1',expression,value:result},3,{states:{result:`calc:1 · ${values(result)}`}}),
      step(wrong?'任务评分抓住了符号错误':'通过当前任务评分',['score'],['result:score'],wrong?'计算与引用仍然一致，但 50352 不符合库存题；任务评分拒绝它。':'答案、引用与结束状态符合这道教学题的要求。','解释“工具执行通过”和“任务通过”分别证明了什么。',{execution_consistent:true,answer_correct:sameNumber(result,'51768'),task_success:sameNumber(result,'51768')},4,{bad:wrong?['score']:[],states:{score:wrong?'拒绝 · 业务公式错误':'通过 · 51768'}})
    ]};
}

function recoveryScene(options,experiments){
  const trial=experiments.trials.find(t=>t.run==='recovery-20261023');
  if(!trial)throw new Error('缺少真实恢复轨迹');
  const budget=options.recovery==='budget';
  const frames=[
    step('第一次调用计算器',['model','dispatch'],['model:dispatch','dispatch:tool'],'资料已在初始输入里，这条真实轨迹直接提出 calculate，没有额外 read。','先看记录中的真实动作，不要给轨迹补上并未发生的步骤。',trial.trace[0].action,0),
    step('临时故障返回',['tool','history'],['tool:history'],'计算器返回 TEMPORARY_UNAVAILABLE，并明确允许重试。','把 ok=false 和 retryable 写进观察，不要伪装成正常值。',trial.trace[0].observation,1,{bad:['tool']}),
    step('再做一次决策',['history','model'],['history:model'],'下一轮读取这条失败观察，重新提出相同计算。这个工具没有业务写入副作用。','换成写接口时，先定义操作标识、幂等与未知状态处理。',trial.trace[1].action,2),
    step('这次获得成功观察',['tool','history'],['model:dispatch','dispatch:tool','tool:history'],'工具这次返回 calc:1 和 51768。此时计算完成，finish 还没有提交。','暂停在这里，分别指出工具状态与整个任务状态。',trial.trace[1].observation,3,{states:{tool:'成功 · 51768'}})
  ];
  frames.push(budget?
    step('预算耗尽，不能伪报完成',['dispatch'],[],'假设只允许两次决策，轨迹到这里就被截断；正确数值仍不能代替 finish。','为预算耗尽写一个预期失败用例。',{status:'step_budget_exhausted',answer:null,calculated_value:'51768',task_success:false},4,{bad:['dispatch'],states:{finish:'尚未提交'}}):
    step('第三次决策提交 finish',['finish'],['history:model','model:dispatch','dispatch:finish'],'原始记录在第三次决策结束，引用成功计算。实测总耗时 24.39 秒，动画播放时间另算。','在结果里同时保留 finish、计算引用和累计用量。',{...trial.trace[2].action,status:trial.status,elapsed_s:trial.elapsed_s,model_calls:trial.model_calls},5,{states:{finish:'finished · calc:1'}}));
  return {nodes:baseNodes(),edges:[edge('task','model','初始资料'),edge('model','dispatch','动作'),edge('dispatch','tool','调用'),edge('tool','history','观察'),edge('history','model','反馈'),edge('dispatch','finish','提交')],
    label:budget?'截断轨迹的假设演示 · 未新增实测':'真实记录回放 · 3 次模型决策',note:budget?'只演示两次决策上限的后果；这是对原轨迹的假设截断，不是另一次模型实验。':`来源 ${trial.id}。原始动作、错误与成功返回保留；动画慢放不复现真实时间间隔。`,
    options:[{key:'recovery',label:'路径',value:budget?'budget':'record',items:[['record','原始恢复记录'],['budget','仅两次决策的假设']]}],
    file:'agent_lab/agent.py',code:['action = backend.step(task, history)','observation = world.call(action)','history.append((action, observation))','observation = world.call(retry_action)','return incomplete("step_budget_exhausted")','return finish(action)'],frames,trialId:trial.id};
}

function contextScene(options,experiments){
  const size=options.size==='100'?'100':'1028';
  const find=run=>experiments.trials.find(t=>t.run===run&&t.case_id==='docs-multihop'&&t.mode==='tools');
  const full=find(size==='100'?'pilot-20261023':'context-full-1024-20261023');
  const indexed=find(size==='100'?'retrieval-20261023':'context-indexed-1024-20261023');
  const measured=t=>({trial:t.id,input_tokens:t.usage.input_tokens,model_calls:t.model_calls,elapsed_s:t.elapsed_s});
  return {nodes:[node('docs','资料集合','CORPUS','这是一道发布资料追踪题，与库存题分开。'),node('full','一次装入全文','FULL CONTEXT','用一次模型调用直接回答。'),node('fullResult','全文总用量','MEASURED','累计输入包含后端提示等开销，不等于正文长度。'),node('search','按需搜索','RETRIEVAL','先查事件与固定手册，再查目标发布记录。'),node('history','下一轮再次输入','HISTORY','后续调用会再次携带提示和部分历史。'),node('indexedResult','检索总用量','MEASURED','三次模型决策的输入相加，不能只算命中正文。')],
    edges:[edge('docs','full','全文输入'),edge('full','fullResult','1 次调用'),edge('docs','search','search'),edge('search','history','搜索观察'),edge('history','search','再次搜索'),edge('history','indexedResult','汇总 3 次调用')],
    options:[{key:'size',label:'资料规模',value:size,items:[['100','100 份资料'],['1028','1,028 份资料']]}],
    label:'真实单题数据 · 每条件测量一次',note:'节点大小和移动速度只是讲解示意；不虚构逐次 token 分摊。两种方法都通过这道题，不能由此推断通用长上下文能力。',file:'agent_lab/agent.py',
    code:['full_input = question + all_documents','answer = backend.step(full_input)','hits = search(query)','history.append(search_observation)','action = backend.step(question, history)','total_input = sum(call.input_tokens for call in calls)'],
    frames:[
      step('同一道问题，同一份资料',['docs'],[],'从事件找到固定运行手册，再沿发布编号找到被批准产物。先固定任务，再比较输入策略。','保持题目、资料权限、模型与任务评分一致。',{documents:Number(size),case:'docs-multihop',conditions:['full','retrieval']},0,{states:{docs:`${values(size)} 份资料`}}),
      step('全文路径，一次回答',['full','fullResult'],['docs:full','full:fullResult'],'全文直接进入一次请求。这里展示整个任务测得的输入与耗时。','分清原始文档体积与实际请求的 input_tokens。',measured(full),1,{states:{fullResult:`${values(full.usage.input_tokens)} token`}}),
      step('检索路径，第一次搜索',['search'],['docs:search'],'第一条动作搜索事件与固定手册，观察返回后才知道下一步查询。','保留查询和实际命中项，检查证据路径。',indexed.trace[0],2),
      step('把观察带回，搜索发布编号',['history','search'],['search:history','history:search'],'第二次决策继续搜索 REL-842。下一轮输入又会带入后端提示和部分历史。','累计所有请求用量；不要只数搜索返回的正文。',indexed.trace[1],3),
      step('第三次决策提交答案',['indexedResult'],['search:history','history:indexedResult'],'检索路径的第三次动作是 finish。这里才汇总三次请求的总输入。','检查任务成功和引用之后，再比较累计用量。',{...measured(indexed),finish:indexed.trace[2].action},5,{states:{indexedResult:`${values(indexed.usage.input_tokens)} token`}}),
      step('比较全过程',['fullResult','indexedResult'],[],size==='100'?'100 份资料时，检索的累计输入更多、耗时更长。':'1,028 份资料时，检索累计输入更少，但耗时仍更长。','切换规模，然后写下这个结论尚未覆盖的任务类型。',{full:measured(full),retrieval:measured(indexed),both_pass:true,repetitions_per_condition:1},5,{states:{fullResult:`${values(full.usage.input_tokens)} token`,indexedResult:`${values(indexed.usage.input_tokens)} token`}})
    ],comparison:{full:measured(full),retrieval:measured(indexed)}};
}

function verificationScene(options){
  const variant=['wrong','unfinished'].includes(options.check)?options.check:'correct';
  const expression=variant==='wrong'?'411*152-11260-708-152':inventory;
  const answer=calculate(expression),finished=variant!=='unfinished',correct=sameNumber(answer,'51768');
  const result={expression,answer,status:finished?'finished':'time_budget_exhausted',citation:'calc:1'};
  return {nodes:[node('answer','待验收结果','CANDIDATE','包含答案、计算引用与结束状态。'),node('syntax','动作结构','SCHEMA','只能证明字段和类型合法。'),node('compute','执行一致','EXECUTION','检查答案是否等于被引用计算的返回。'),node('verdict','任务通过？','OUTCOME','所有任务要求都成立才算通过。'),node('finish','完成状态','LIFECYCLE','正确数值不能把超时变成 finished。'),node('meaning','任务答案','EXTERNAL GRADE','教学评分在模型之外掌握正确结果。')],
    edges:[edge('answer','syntax','结构'),edge('syntax','compute','数值'),edge('compute','meaning','独立答案'),edge('meaning','finish','生命周期'),edge('finish','verdict','合并检查')],
    options:[{key:'check',label:'待检查结果',value:variant,items:[['correct','正确公式且完成'],['wrong','退货符号写错'],['unfinished','数值正确但超时']]}],
    label:'确定性反例 · 0 次模型调用',note:'这是已知答案的教学题。开放式任务还需要证据语义与环境状态的评分规则。',file:'run.py',
    code:['schema_ok = validate(action)','consistent = answer == observed_calculation','answer_correct = answer == expected','finished = status == "finished"','task_success = consistent and answer_correct and finished'],
    frames:[
      step('把结果拆开看',['answer'],[],'不要只读最后一个数值，把公式、引用和状态一并拿出来。','构造一个数值没抄错、业务却理解错的反例。',result,0),
      step('结构合法',['syntax'],['answer:syntax'],'这三种结果都可以满足格式要求。JSON 合法只是一道入口检查。','不要用结构化输出通过来代替业务验收。',{schema_valid:true},0),
      step('计算与答案一致',['compute'],['syntax:compute'],'工具精确算完给定表达式，答案也忠实地引用了计算。符号错了仍可能通过这一层。','将执行一致性与独立的正确答案分开报告。',{execution_consistent:true,calculated_value:answer},1),
      step(correct?'符合独立答案':'独立答案发现错误',['meaning'],['compute:meaning'],correct?'这个答案与库存题的正确结果 51768 一致。':'退货被减掉，得到 50352。外部答案检查在这里抓住它。','评分答案不进入运行时输入；结束后再比较。',{answer_correct:correct,expected:'51768',actual:answer},2,{bad:correct?[]:['meaning']}),
      step(finished?'结束状态满足要求':'超时不是完成',['finish'],['meaning:finish'],finished?'状态为 finished，表明循环接受了明确的结束动作。':'尽管数值正确，状态仍是 time_budget_exhausted，任务不能报成功。','为“结果正确但状态未完成”保留一个失败用例。',{finished,status:result.status},3,{bad:finished?[]:['finish']}),
      step(correct&&finished?'通过这道任务':'拒绝完整任务',['verdict'],['finish:verdict'],'最终判断合并每项要求；单独一层通过，不能替整个任务盖章。','写出每个检查能证明什么，以及仍然漏什么。',{execution_consistent:true,answer_correct:correct,finished,task_success:correct&&finished},4,{bad:correct&&finished?[]:['verdict'],states:{verdict:correct&&finished?'通过':'未通过'}})
    ],result:{answer_correct:correct,finished,task_success:correct&&finished}};
}

const architectures={
  codex:{name:'Codex',question:'客户端与执行运行时怎样分工？',source:'codex-protocol',
    nodes:[node('client','产品客户端','CLIENT','展示进度、处理中断和交互。','codex-platform'),node('runtime','Codex 运行时','HARNESS','管理会话、模型往返和工具生命周期。','codex-platform'),node('model','模型访问','MODEL','提供响应与候选动作，执行仍由运行时处理。','codex-platform'),node('events','进度与交互','ITEMS','工具活动等条目组成可观察过程。','codex-protocol'),node('state','会话状态','THREAD / TURN','thread、turn、item 区分会话、工作和执行条目。','codex-protocol'),node('tools','执行边界','TOOLS','审批与沙箱承担不同职责，具体覆盖依赖配置。','codex-sandbox')],
    edges:[edge('client','runtime','请求'),edge('runtime','model','上下文'),edge('model','runtime','响应'),edge('runtime','tools','工具执行'),edge('tools','runtime','观察'),edge('runtime','state','会话'),edge('runtime','events','条目'),edge('events','client','进度')],
    frames:[['发起一次工作',['client','runtime'],['client:runtime'],'客户端需要管理会话、一次工作和条目，不能只展示最后一段文字。','给自己的页面定义 task_id、状态查询与中断入口。'],['运行时调用模型',['runtime','model'],['runtime:model'],'构造上下文与选择执行边界是运行时职责。','把后端适配器和自己的业务资料构造分开。'],['动作回到执行层',['runtime','tools'],['model:runtime','runtime:tools'],'动作先回到运行时，再在约定的权限与资源边界内执行。','分别检查动作是否获准，以及实际能访问哪些资源。'],['观察与条目返回',['runtime','events','state'],['tools:runtime','runtime:state','runtime:events'],'执行过程产生可观察条目，会话状态与生命周期也需要维护。','为失败、等待交互和结束定义明确状态。'],['把进度交给产品',['events','client'],['events:client'],'客户端根据事件更新界面，仍需独立处理断线与完成判定。','把事件展示和任务验收分成两个组件。']]},
  claude:{name:'Claude Code',question:'上下文约定与执行检查在哪里分开？',source:'claude-loop',
    nodes:[node('context','项目约定与记忆','CONTEXT','CLAUDE.md 与自动记忆作为上下文，不是强制隔离。','claude-memory'),node('runtime','任务循环','HARNESS','获取上下文、采取行动、验证，再根据观察继续。','claude-loop'),node('model','模型决策','MODEL','在可用上下文中提出下一步。','claude-loop'),node('history','工具观察与验证','FEEDBACK','真实反馈更新后续输入；长上下文可能被压缩。','claude-loop'),node('policy','权限与生命周期','POLICY','权限和 hooks 语义依事件、类型和配置而异。','claude-hooks'),node('tools','工具执行','TOOLS','Bash 沙箱并不自动覆盖所有文件工具、MCP 与 hooks。','claude-sandbox')],
    edges:[edge('context','runtime','提供上下文'),edge('runtime','model','构造输入'),edge('model','runtime','候选动作'),edge('runtime','policy','执行检查'),edge('policy','tools','受控执行'),edge('tools','history','观察'),edge('history','runtime','反馈')],
    frames:[['加载当前需要的约定',['context','runtime'],['context:runtime'],'文字约定影响输入，却不能代替执行层边界。','区分团队操作指南与必须由程序阻止的动作。'],['循环提出行动',['runtime','model'],['runtime:model'],'模型获取当前上下文，再提出行动；观察会改变下一轮选择。','保留输入视图与后端输出。'],['在执行路径检查',['policy','tools'],['model:runtime','runtime:policy','policy:tools'],'权限规则与生命周期检查落在执行路径，不能只放在提示里。','为你实际采用的权限与 hook 测失败行为。'],['验证后再继续',['history','runtime'],['tools:history','history:runtime'],'工具结果和验证反馈回到循环；获取、行动与验证可以重复。','从一条失败观察追到下一次行动。']]},
  pi:{name:'Pi',question:'完整会话怎样变成下一次模型输入？',source:'pi-core',
    nodes:[node('session','完整会话树','JSONL','id / parentId 记录分支；磁盘中保留不等于本轮可见。','pi-session'),node('view','上下文变换','CONTEXT VIEW','transformContext 与 convertToLlm 将活动消息转成模型输入。','pi-core'),node('model','模型访问','MODEL','看到的是本轮输入视图，而非整个持久会话树。','pi-core'),node('history','新观察与条目','APPEND','保存新的动作、观察和会话条目。','pi-session'),node('runtime','Agent 循环','HARNESS','执行与下一轮上下文投影构成持续过程。','pi-core'),node('tools','可用工具','TOOLS','默认工具描述核心选择；固定快照还支持扩展和 MCP。','pi-tools')],
    edges:[edge('session','view','活动消息'),edge('view','model','模型输入'),edge('model','runtime','动作'),edge('runtime','tools','执行'),edge('tools','history','观察'),edge('history','session','追加会话')],
    frames:[['先看完整记录',['session'],[],'会话可以保留分支与原始条目，供回看和继续。','在日志中保留稳定的条目标识与来源。'],['再看本轮输入视图',['view','model'],['session:view','view:model'],'历史经过上下文变换再给模型，不能假设磁盘里的内容都会进入请求。','比较完整历史与实际请求里各有哪些字段。'],['循环执行动作',['runtime','tools'],['model:runtime','runtime:tools'],'模型输出由 Agent 循环接手，调用可用工具。','将工具适配器保持为可独立测试的函数。'],['观察追加回会话',['history','session'],['tools:history','history:session'],'新的观察保存为后续可投影的信息；压缩也需要检查关键条件是否保留。','用带修订单的任务检查压缩是否丢失新条件。']]},
  opencode:{name:'OpenCode V2',question:'实时事件丢了，怎样找回真实状态？',source:'oc-client',
    nodes:[node('client','浏览器 / TUI','CLIENT','通过 HTTP API 发请求并订阅 SSE。','oc-client'),node('server','服务端','RUNTIME','接收请求，管理会话与执行。','oc-api'),node('model','模型访问','MODEL','模型往返由服务端运行时管理。','oc-step-code'),node('state','持久会话','SQLITE','消息与执行历史需要另行查询，不能只依赖实时事件。','oc-storage-code'),node('events','实时事件','SSE','实时流可能在断线期间错过事件。','oc-client'),node('tools','工具执行','TOOLS','工具依据权限规则执行，Plan 不等于通用沙箱。','oc-permissions')],
    edges:[edge('client','server','HTTP 请求'),edge('server','model','上下文'),edge('model','server','响应'),edge('server','tools','执行'),edge('tools','server','观察'),edge('server','state','持久读写'),edge('state','server','状态'),edge('server','events','事件'),edge('events','client','实时进度'),edge('server','client','状态响应')],
    frames:[['客户端发送请求',['client','server'],['client:server'],'界面通过服务端接口发起工作；界面本身不拥有所有执行状态。','用稳定标识关联请求与任务。'],['服务端执行动作',['server','model','tools'],['server:model','model:server','server:tools'],'模型与工具在服务端运行，界面断线不代表业务动作会撤销。','为写操作增加操作标识与幂等规则。'],['保存状态，发布事件',['state','events'],['tools:server','server:state','server:events'],'持久会话与实时事件分别承担保存与即时展示。','把持久状态与事件流在架构图中分开。'],['实时流可能错过',['events','client'],['events:client'],'SSE 断线后，少一条事件不证明对应动作没发生。','不要凭最后一条界面消息直接重发写请求。'],['重连先查询服务端',['client','server','state'],['client:server','server:state','state:server','server:client'],'通过服务端查询持久状态，再补结果、继续等待或按幂等规则处理。','画出已完成、未提交和仍未知的三种后续流程。']]}
};

function architectureScene(options,agents){
  const key=Object.hasOwn(architectures,options.agent)?options.agent:'codex';
  const a=architectures[key],research=agents.find(a=>a.id===key);
  const source=research?.sources.find(s=>s.id===a.source);
  return {nodes:a.nodes,edges:a.edges,options:[{key:'agent',label:'实现',value:key,items:Object.entries(architectures).map(([id,a])=>[id,a.name])}],
    label:`${a.name} · 公开资料的教学抽象`,note:`${a.question} 依据 ${research?.checked_date||'既有核实'} 的公开资料${research?.repo_revision?`，源码固定为 ${research.repo_revision.slice(0,12)}`:''}；不是完整内部类图，也不是一次实测调用。`,
    code:a.frames.map(([title])=>`# ${title}`),codeLabel:'架构走读顺序 · 不是产品内部源码',
    frames:a.frames.map(([title,active,edges,text,todo],i)=>step(title,active,edges,text,todo,{implementation:a.name,view:'公开资料抽象',source:source?.url||'',step:title},i)),
    sources:research?.sources||[],agent:key};
}

function evaluationScene(experiments){
  const primary=experiments.trials.filter(t=>t.run==='pilot-20261023');
  const summary=mode=>{const rows=primary.filter(t=>t.mode===mode);return {mode,passed:rows.filter(t=>t.grade.task_success).length,total:rows.length,model_calls:rows.reduce((n,t)=>n+t.model_calls,0),input_tokens:rows.reduce((n,t)=>n+t.usage.input_tokens,0)};};
  const direct=summary('direct'),tools=summary('tools'),checked=summary('checked');
  return {nodes:[node('tasks','冻结的六道开发题','DATA','每题固定资料与外部评分，三组都报告原始分母。'),node('direct','单次回答','DIRECT','一次回答，关闭原生工具；不是默认 Codex 产品。'),node('tools','允许工具','TOOLS','可以执行多轮工具往返，资源预算与单次组不同。'),node('checked','工具 + 证据门','CHECKED','在工具组之外增加检查条件。'),node('score','相同任务评分','EVAL','根据每题预先写好的规则评分，保留失败与状态。'),node('report','结论与下一轮','REPORT','三组全通过时，题目还不能区分准确率。')],
    edges:[edge('tasks','direct','相同任务'),edge('tasks','tools','相同任务'),edge('tasks','checked','相同任务'),edge('direct','score','保留结果'),edge('tools','score','保留结果'),edge('checked','score','保留结果'),edge('score','report','分母与用量')],
    label:'18 次主对照任务 · 从既有记录汇总',note:'不是四家产品排名。多轮组与单次组的预算不同，不能把所有差异归因于工具或验证机制。',file:'run.py',
    code:['freeze(task_data, scoring, budgets)','results = run_condition("direct")','results = run_condition("tools")','results = run_condition("checked")','scores = independent_grade(all_results)','report(scores, denominators, usage, limits)'],
    frames:[
      step('先固定比较条件',['tasks'],[],'六道开发题覆盖算术、库存和资料任务。先列出任务、权限、预算和评分。','为下一轮保留未参与调试的题，别只换一个提示词。',{tasks:6,conditions:3,trials:18},0),
      step('单次回答组',['direct'],['tasks:direct'],'保留这组的全部六次结果、调用次数与累计用量。','把每个条件真正获得的预算写进实验单。',direct,1,{states:{direct:`${direct.passed}/${direct.total} 通过`}}),
      step('允许工具组',['tools'],['tasks:tools'],'这组也通过六题，但用了更多模型决策。分母相同不表示预算相同。','若要拆分工具贡献，补一个同预算的无工具复核组。',tools,2,{states:{tools:`${tools.passed}/${tools.total} 通过`}}),
      step('工具加检查组',['checked'],['tasks:checked'],'增加检查之后，仍是六题全通过。不能从满分推断机制没有成本或一定更强。','记录检查带来的额外调用与它实际抓住的错误。',checked,3,{states:{checked:`${checked.passed}/${checked.total} 通过`}}),
      step('统一评分，再看分母',['score'],['direct:score','tools:score','checked:score'],'对所有结束状态做外部评分，不能删除不完成的任务再算成功率。','将数值正确、引用要求和任务结束分别检查。',{direct,tools,checked},4),
      step('题目饱和，继续找分歧',['report'],['score:report'],'三个 6/6 说明循环跑通，也说明还没有准确率差异的证据。','下一轮增加修订单、信息位置与故障条件，并事先约定反对证据。',{accuracy_difference_observed:false,public_benchmark:false,next:'冻结更有区分度的任务与同预算对照'},5)
    ],summary:[direct,tools,checked]};
}

function invalidationScene(options){
  const propagate=options.invalidation!=='missed';
  const original=calculate(inventory),initial=calculate('411*152'),newInitial=calculate('400*152'),updated=calculate('400*152-11260+708-152');
  const states0={source:'v1 · 411 箱',initial:`${values(initial)} · v1`,remaining:`${values(original)} · v1`};
  const states1={...states0,source:'v2 · 400 箱'};
  return {nodes:[node('source','有效库存单','SOURCE','来源版本与数量一起保存，更新后沿依赖检查缓存。'),node('initial','初始件数','DERIVED','箱数 × 每箱件数，依赖来源版本。'),node('remaining','可售库存','DERIVED','初始件数 − 发出 + 退货 − 报损。'),node('damage','报损数量','UNCHANGED','这次仍是 152 件，不因箱数更新而改变。'),node('shipped','已发出数量','UNCHANGED','这次仍是 11260 件。'),node('returned','可售退货','UNCHANGED','这次仍是 708 件。')],
    edges:[edge('source','initial','来源版本'),edge('initial','remaining','计算依赖'),edge('damage','remaining','− 152'),edge('shipped','remaining','− 11260'),edge('returned','remaining','+ 708')],
    options:[{key:'invalidation',label:'更新策略',value:propagate?'propagate':'missed',items:[['propagate','传播失效并复算'],['missed','漏掉缓存失效']]}],
    label:'依赖失效机制演示 · 0 次模型调用',note:'这里运行的是确定性状态演示。Python runner 尚无中途更新接口；不能把动画当作已经完成的修订单模型实验。',
    code:['save(source="v1", initial=62472, remaining=51768)','source = revision("v2", boxes=400)','invalidate(dependents_of(source))','initial = calculate("400*152")','remaining = calculate("60800-11260+708-152")','check(source_version, dependencies, result)'],
    frames:[
      step('从旧版本开始',['source','initial','remaining'],['source:initial','initial:remaining'],'v1 的 411 箱计算出初始 62472 件，可售库存 51768。','把来源版本与派生结果关联保存。',{source_version:'v1',boxes:411,initial,remaining:original},0,{states:states0}),
      step('收到明确生效的修订单',['source'],[],'v2 把箱数改为 400，发出、退货和报损没有变化。','首先记录有效来源发生了更新，不要悄悄覆盖旧轨迹。',{source_version:'v2',boxes:400},1,{states:states1}),
      step(propagate?'沿依赖标记失效':'缓存没有跟着失效',propagate?['initial','remaining']:['source'],['source:initial','initial:remaining'],propagate?'两个派生结果都依赖旧箱数，需要复算；其他输入仍可复用。':'来源已经是 v2，初始件数和可售库存却还保留旧版本结果。','说明哪些值因本次更新失效，哪些值不受影响。',{invalidated:propagate?['initial','remaining']:[],source_version:'v2'},2,{states:states1,stale:propagate?['initial','remaining']:[],bad:propagate?[]:['initial','remaining']}),
      step(propagate?'先复算直接依赖':'继续读到旧缓存',['initial'],['source:initial'],propagate?'初始件数改为 60800。可售库存仍在等待复算。':'复用 62472 这个精确的旧数值，仍然会把后续计算带错。','按依赖先后顺序复算，并携带来源版本。',{initial:propagate?newInitial:initial},3,{states:{...states1,initial:`${values(propagate?newInitial:initial)} · ${propagate?'v2':'v1'}`},stale:propagate?['remaining']:[],bad:propagate?[]:['initial']}),
      step(propagate?'再复算最终库存':'提交了版本不一致的结果',['remaining'],['initial:remaining','damage:remaining','shipped:remaining','returned:remaining'],propagate?'用新的初始件数，加上未变的其他条件，得到 50096。':'精确计算不能弥补旧来源；结果仍是 51768，外部任务答案应拒绝它。','对结果数值与所用来源版本同时验收。',{expected:updated,actual:propagate?updated:original,task_success:propagate},5,{states:{source:'v2 · 400 箱',initial:`${values(propagate?newInitial:initial)} · ${propagate?'v2':'v1'}`,remaining:`${values(propagate?updated:original)} · ${propagate?'v2':'v1'}`},bad:propagate?[]:['remaining']})
    ],result:{expected:updated,actual:propagate?updated:original,task_success:propagate}};
}

export function createScene(id,options={},data={}){
  const factories={'01':()=>loopScene(),'02':()=>toolScene(options),'03':()=>recoveryScene(options,data.experiments),'04':()=>contextScene(options,data.experiments),'05':()=>verificationScene(options),'06':()=>architectureScene(options,data.agents),'07':()=>evaluationScene(data.experiments),'08':()=>invalidationScene(options)};
  if(!factories[id])throw new Error('未知动画章节');
  return {...sceneCatalog.find(s=>s.id===id),...factories[id]()};
}
