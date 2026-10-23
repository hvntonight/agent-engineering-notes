"""Build a self-contained GitHub Pages /docs site from this repository only."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import zipfile

ROOT=Path(__file__).resolve().parent


def main():
    spec=importlib.util.spec_from_file_location('curriculum',ROOT/'src/course.py')
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    target=ROOT/'docs'
    (target/'data').mkdir(parents=True,exist_ok=True)
    cases=json.loads((ROOT/'src/tutorial-cases.json').read_text())
    content={**module.META,'chapters':module.CHAPTERS,'references':cases}
    (target/'data/course.json').write_text(json.dumps(content,ensure_ascii=False,indent=2),encoding='utf-8')
    for name in ['agents.json','experiments.json']:
        shutil.copyfile(ROOT/'src'/name,target/'data'/name)
    shutil.copyfile(ROOT/'reviews/index.json',target/'data/review-log.json')
    files=[p for p in (ROOT/'lab').rglob('*') if p.is_file() and p.suffix in ['.py','.md','.json'] and '__pycache__' not in p.parts and 'results' not in p.parts]
    for source in files:
        dest=target/'lab'/source.relative_to(ROOT/'lab')
        dest.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(source,dest)
    with zipfile.ZipFile(target/'lab/agent-lab.zip','w',compression=zipfile.ZIP_DEFLATED) as archive:
        for source in sorted(files):
            info=zipfile.ZipInfo(str(source.relative_to(ROOT/'lab')),(2026,10,24,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED
            archive.writestr(info,source.read_bytes())
    manifest={}
    for source in sorted(target.rglob('*')):
        if source.is_file() and source.name not in ['build-manifest.json','review-log.json']:
            manifest[str(source.relative_to(target))]=hashlib.sha256(source.read_bytes()).hexdigest()
    payload={'version':module.META['version'],'files':manifest,'chapters':len(module.CHAPTERS),'tutorial_cases':len(cases)}
    (target/'data/build-manifest.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f"Built {len(module.CHAPTERS)} chapters, {len(cases)} tutorial cases, {len(manifest)} public files")


if __name__=='__main__':main()
