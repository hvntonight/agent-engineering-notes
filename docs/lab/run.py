"""Small local lab. Scripted mode tests the harness, Codex mode calls a real model."""
import argparse
from fractions import Fraction
import json
from pathlib import Path
import tempfile

from agent_lab.agent import run_agent
from agent_lab.backend import CodexBackend


class ScriptedPolicy:
    """A deterministic test fixture. It does not understand a new natural-language task."""
    def __init__(self, expression):
        self.expression = expression

    def step(self, prompt, directory, timeout=None):
        text = prompt.rsplit("\nACTION_OBSERVATION_HISTORY:\n", 1)[1]
        history, _ = json.JSONDecoder().raw_decode(text)
        if not history:
            action = {"action":"read","argument":"inventory-current"}
        elif history[-1].get("observation",{}).get("retryable"):
            action = dict(history[-1]["action"])
        elif history[-1]["action"]["action"] == "read":
            action = {"action":"calculate","argument":self.expression}
        else:
            observation = history[-1]["observation"]
            action = {"action":"finish","answer":observation["value"],"citations":[observation["id"]]}
        return {"argument":"","answer":"","citations":[],"note":"",**action}, {"usage":{}}


def grade(case, result):
    try:
        correct = Fraction(result["answer"]) == Fraction(case['expected'])
    except (ValueError,ZeroDivisionError):
        correct = False
    calculations={entry['observation']['id']:entry['observation']['value']
                  for entry in result.get('trace',[])
                  if entry.get('action',{}).get('action')=='calculate'
                  and entry.get('observation',{}).get('ok')}
    citations=result.get('citations',[])
    known=set(case['documents'])|calculations.keys()
    citations_ok=all(ref in known for ref in citations)
    if calculations:
        matching=[]
        for ref in citations:
            if ref in calculations:
                try: matching.append(Fraction(calculations[ref])==Fraction(result['answer']))
                except (ValueError,ZeroDivisionError): matching.append(False)
        citations_ok=citations_ok and any(matching)
    return {'answer_correct':correct,'citations_ok':citations_ok,
            'task_success':correct and citations_ok and result['status']=='finished'}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend", choices=["scripted","codex"],default="scripted")
    parser.add_argument("--steps",type=int,default=6)
    parser.add_argument("--fail-first",choices=["calculate","read"])
    parser.add_argument("--model",default="gpt-6.1-sol")
    parser.add_argument("--mode",choices=["direct","tools","checked"],default="tools")
    parser.add_argument("--task",type=Path,default=Path(__file__).parent/'task.json')
    parser.add_argument("--output",type=Path,help="New output directory (optional)")
    args=parser.parse_args()
    case=json.loads(args.task.read_text())
    # The live model sees only the task and documents, never the expected answer or scripted fixture.
    task={key:case[key] for key in ["question","documents"]}
    backend=ScriptedPolicy(case["fixture_expression"]) if args.backend=='scripted' else CodexBackend(model=args.model)
    if args.output:
        args.output.mkdir(parents=True,exist_ok=False)
        directory=args.output
        temporary=None
    else:
        temporary=tempfile.TemporaryDirectory(prefix='agent-notes-lab-')
        directory=Path(temporary.name)
    try:
        result=run_agent(backend,task,args.mode,directory,max_steps=args.steps,fail_first=args.fail_first).to_dict()
        result['decision_steps']=result.pop('model_calls')
        result['model_calls']=result['decision_steps'] if args.backend=='codex' else 0
        result['backend']=args.backend
        result.update(grade(case,result))
        print(json.dumps(result,ensure_ascii=False,indent=2))
        if args.output:(directory/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        return 0 if result['task_success'] else 1
    finally:
        if temporary:temporary.cleanup()


if __name__=='__main__':
    raise SystemExit(main())
