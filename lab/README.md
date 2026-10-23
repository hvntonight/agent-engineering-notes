# 库存核对 Agent 实验

要求 Python 3.12+。默认只运行确定性测试，不安装依赖，不访问网络，不调用模型。

```bash
python3 run.py
python3 run.py --fail-first calculate
python3 run.py --fail-first calculate --steps 3
```

前两条应完成并得到 `51768`。第三条会耗尽步数：最后一次计算成功，但还没有足够步数提交答案，退出码为 1。它检验预算与结束状态，不能代表模型能力。

实际模型实验需要已经安装并登录的官方 Codex CLI。这个适配器沿用实验时的 CLI 接口（0.164.0），复用已有 ChatGPT 登录，不复制认证文件；关闭原生工具，由本项目执行受限动作。只有下列命令才会调用 Codex 并消耗账户额度：

```bash
codex --version
codex login status
python3 run.py --backend codex --model gpt-6.1-sol --output results/live-01
```

若账户没有该模型，使用 `--model` 指定自己的可用模型。出现未知 CLI 参数或认证错误时先检查版本与官方文档，不要删除工具边界后继续比较。CLI 后端含有其内置提示，因此它不是裸模型实验。

`agent_lab/agent.py` 是循环、上下文与预算；`tools.py` 是精确计算、读取和检索；`backend.py` 是官方 CLI 传输；`run.py` 编排测试或真实运行；`task.json` 保存公开教学任务、测试策略所用的公式和评分答案。真实模型的输入由允许列表构造，不接收评分答案。

`run.py` 独立报告 `answer_correct`、`citations_ok` 与 `task_success`。成功使用过计算器时，任务通过还要求引用观察到的、数值一致的计算记录；结束状态必须是 `finished`。它仍不证明任意开放问题的引用语义。

生成资料规模与位置变体，并实际测量用量：

```bash
python3 add_documents.py --count 20 --position middle --out task-20.json
python3 run.py --task task-20.json --backend codex --output results/docs-20
```

在 `results/docs-20/result.json` 里查看 `usage.input_tokens`、`model_calls`、`elapsed_s` 与完整轨迹。位置可改成 start/end；`--older` 只额外加入一份明确标为过期的记录。每次输出文件和结果目录用新名字。默认 scripted 策略没有模型 token，用它不能测上下文性能。

当前 runner 在启动时读取任务，尚未实现中途资料更新。课件第 7 节的修订单试验是测试设计作业，需要先增加步边界事件与独立环境夹具；不要将启动前改 JSON 说成中途更新实验。浏览器中的失效传播图只是确定性机制演示。

小改动练习：把退回的 708 件改成 500 件。分别检查问题资料、脚本测试策略和评分答案。脚本策略若仍保留原公式，就可能继续得到旧答案；这不表示模型答错，而表示测试夹具与任务不一致。为新任务另写独立计算，避免把实现当成自己的评分标准。

参考课程：Agent 工程笔记。学习顺序与借鉴来源列在网页书架中。本实验代码不是 mini-SWE-agent、Stanford 作业或其他项目源码的复制。
