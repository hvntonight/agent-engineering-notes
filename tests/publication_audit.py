"""Fail closed on private material, broken local URLs or changed real trial totals."""
import hashlib
import json
from pathlib import Path
import re
import zipfile

ROOT=Path(__file__).resolve().parents[1]
SKIP={'.git','.qa','qa-artifacts','__pycache__','local-results','node_modules','results'}
TOP={'src','docs','lab','tests','reviews'}
FILES={'.gitignore','README.md','build.py','package.json'}


def public_files():
    """Use the same explicit publication boundary as the external REST client."""
    for path in sorted(ROOT.rglob('*')):
        relative=path.relative_to(ROOT)
        if not path.is_file() or any(part in SKIP for part in relative.parts):continue
        if relative.parts[0] not in TOP and str(relative) not in FILES:continue
        if path.name.startswith('.') and path.name not in {'.nojekyll','.gitignore'}:continue
        if path.suffix not in {'.py','.json','.js','.mjs','.css','.html','.md','.svg','.zip',''}:continue
        assert not path.is_symlink(),f'Symlink in publication set: {relative}'
        yield path


def scan():
    docs=ROOT/'docs'
    findings=[]
    patterns=[r'github_pat_[A-Za-z0-9_]{15,}',r'gh[pousr]_[A-Za-z0-9_]{15,}',r'/home/[a-zA-Z0-9_-]+/',r'192\.168\.\d+\.\d+',r'agent_course[_]session',r'learner-login\.json',r'github_pat\.txt',r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----']
    checked=0
    paths=list(public_files())
    for path in paths:
        if path.suffix=='.zip':
            with zipfile.ZipFile(path) as archive:
                entries=[(f'{path.name}:{name}',archive.read(name).decode('utf-8')) for name in archive.namelist()]
        else:
            entries=[(str(path.relative_to(ROOT)),path.read_text(encoding='utf-8'))]
        for name,text in entries:
            checked+=1
            for pattern in patterns:
                if re.search(pattern,text):findings.append({'file':name,'kind':'private_content'})
            if name.endswith(('.html','.js','.css')):
                if re.search(r'''(?:fetch\(|(?:src|href)=)["']/''',text):findings.append({'file':name,'kind':'root_absolute_asset_or_request'})
    content=json.loads((docs/'data/course.json').read_text())
    trials=json.loads((docs/'data/experiments.json').read_text())['trials']
    assert len(content['chapters'])==8
    assert len(content['references'])==14
    assert len(trials)==22
    assert sum(t['model_calls'] for t in trials)==33
    manifest=json.loads((docs/'data/build-manifest.json').read_text())
    for relative,digest in manifest['files'].items():
        assert hashlib.sha256((docs/relative).read_bytes()).hexdigest()==digest,relative
    assert not findings,findings
    return {'public_source_files':len(paths),'public_entries_scanned':checked,'private_content_findings':0,'root_absolute_paths':0,'real_trials':22,'model_decisions':33,'build_hashes':'match'}


if __name__=='__main__':print(json.dumps(scan(),ensure_ascii=False,indent=2))
