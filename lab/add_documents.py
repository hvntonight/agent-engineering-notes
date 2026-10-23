"""Create controlled document variants without calling a model."""
import argparse
import json
from pathlib import Path


def variant(case,count=20,position='middle',older=False):
    result=json.loads(json.dumps(case))
    current=result['documents'].pop('inventory-current')
    rows=[(f'archive-{i:04}',f'Archive only. Unrelated warehouse W-{i:04}; not part of the current inventory accounting period.') for i in range(count)]
    offset=0 if position=='start' else len(rows) if position=='end' else len(rows)//2
    rows.insert(offset,('inventory-current',current))
    if older:rows.append(('inventory-old','SUPERSEDED historical record. 500 boxes with 152 units per box. This is not the current accounting period and must not be used for current stock.'))
    result['documents']=dict(rows)
    return result


if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--count',type=int,default=20)
    parser.add_argument('--position',choices=['start','middle','end'],default='middle')
    parser.add_argument('--older',action='store_true')
    parser.add_argument('--out',type=Path,required=True)
    args=parser.parse_args()
    if not 0<=args.count<=5000:parser.error('count must be between 0 and 5000')
    case=json.loads((Path(__file__).parent/'task.json').read_text())
    result=variant(case,args.count,args.position,args.older)
    args.out.parent.mkdir(parents=True,exist_ok=True)
    with args.out.open('x',encoding='utf-8') as f:json.dump(result,f,ensure_ascii=False,indent=2)
    print(f'Wrote {args.out.name}: {len(result["documents"])} documents. No model called.')
