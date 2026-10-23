"""Verify the actual HTTPS artifact and execute the downloaded lab without a model."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
import zipfile


def fetch(url):
    request=urllib.request.Request(url,headers={'User-Agent':'agent-notes-release-check'})
    with urllib.request.urlopen(request,timeout=30) as response:
        assert response.status==200,(url,response.status)
        assert response.url.startswith('https://'),response.url
        return response.read()


def verify(base,minimum_reviews):
    assert base.startswith('https://') and base.endswith('/')
    html=fetch(base).decode('utf-8')
    assert 'Agent 工程笔记' in html and './assets/app.js' in html
    manifest=json.loads(fetch(base+'data/build-manifest.json'))
    assert manifest['chapters']==8 and manifest['tutorial_cases']==14
    def check(entry):
        relative,digest=entry
        assert not PurePosixPath(relative).is_absolute() and '..' not in PurePosixPath(relative).parts
        actual=hashlib.sha256(fetch(urllib.parse.urljoin(base,relative))).hexdigest()
        assert actual==digest,relative
        return relative
    with ThreadPoolExecutor(max_workers=4) as pool:
        verified=list(pool.map(check,manifest['files'].items()))
    review_log=json.loads(fetch(base+'data/review-log.json'))
    assert len(review_log['rounds'])>=minimum_reviews
    assert [r['round'] for r in review_log['rounds']]==list(range(1,len(review_log['rounds'])+1))
    trials=json.loads(fetch(base+'data/experiments.json'))['trials']
    assert len(trials)==22 and sum(t['model_calls'] for t in trials)==33
    archive=zipfile.ZipFile(io.BytesIO(fetch(base+'lab/agent-lab.zip')))
    runs=[]
    with tempfile.TemporaryDirectory(prefix='agent-release-') as work:
        for entry in archive.infolist():
            name=PurePosixPath(entry.filename)
            assert not name.is_absolute() and '..' not in name.parts
            assert not (entry.external_attr>>16)&0o170000==0o120000
        archive.extractall(work)
        for arguments,exit_code,steps in [([],0,3),(['--fail-first','calculate'],0,4),(['--fail-first','calculate','--steps','3'],1,3)]:
            run=subprocess.run([sys.executable,'run.py',*arguments],cwd=work,capture_output=True,text=True,timeout=15)
            assert run.returncode==exit_code,run.stderr
            result=json.loads(run.stdout)
            assert result['model_calls']==0 and result['decision_steps']==steps
            assert result['task_success']==(exit_code==0)
            if exit_code==0:assert result['answer']=='51768'
            else:assert result['status']=='step_budget_exhausted'
            runs.append({'arguments':arguments,'exit_code':exit_code,'decision_steps':steps,'model_calls':0})
    return {'base':base,'https':'verified','manifest_assets_matched':len(verified),'chapters':8,'tutorial_cases':14,
            'public_review_rounds':len(review_log['rounds']),'real_trials':22,'model_decisions':33,'downloaded_lab_runs':runs}


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--base',default='https://hvntonight.github.io/agent-engineering-notes/')
    parser.add_argument('--minimum-reviews',type=int,default=3)
    args=parser.parse_args()
    result=verify(args.base,args.minimum_reviews)
    output=Path('qa-artifacts/round-3-release.json')
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2))
