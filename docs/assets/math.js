// Exact rational arithmetic. No eval, Function, imports, file access or network execution.
const gcd=(a,b)=>{a=a<0n?-a:a;b=b<0n?-b:b;while(b){[a,b]=[b,a%b];}return a||1n;};
function rational(n,d=1n){if(d===0n)throw new Error('除数为 0，请检查公式或输入数据。');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};}
const apply=(a,b,op)=>{
  if(op==='+')return rational(a.n*b.d+b.n*a.d,a.d*b.d);
  if(op==='-')return rational(a.n*b.d-b.n*a.d,a.d*b.d);
  if(op==='*')return rational(a.n*b.n,a.d*b.d);
  return rational(a.n*b.d,a.d*b.n);
};
export function calculate(source){
  if(typeof source!=='string'||!source.trim())throw new Error('先输入一个表达式。');
  if(source.length>1500)throw new Error('表达式最多 1,500 个字符。');
  const tokens=[];let p=0;
  while(p<source.length){if(/\s/.test(source[p])){p++;continue;}const match=/^(?:\d+(?:\.\d*)?|\.\d+)/.exec(source.slice(p));if(match){tokens.push(match[0]);p+=match[0].length;}else if('+-*/()'.includes(source[p]))tokens.push(source[p++]);else throw new Error('只支持十进制数、+ − * / 和括号。');if(tokens.length>150)throw new Error('表达式过于复杂，请分步计算。');}
  let i=0,depth=0;
  const atom=()=>{
    if(++depth>60)throw new Error('括号嵌套过深。');
    const t=tokens[i++];let value;
    if(t==='+'||t==='-'){value=atom();if(t==='-')value=rational(-value.n,value.d);}
    else if(t==='('){value=expr();if(tokens[i++]!==')')throw new Error('括号不匹配。');}
    else if(t&&/^(?:\d|\.)/.test(t)){const [whole,fraction='']=t.split('.');value=rational(BigInt((whole||'0')+fraction),10n**BigInt(fraction.length));}
    else throw new Error('这里需要一个数值或左括号。');
    depth--;return value;
  };
  const term=()=>{let value=atom();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++];value=apply(value,atom(),op);}return value;};
  const expr=()=>{let value=term();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++];value=apply(value,term(),op);}return value;};
  const result=expr();if(i!==tokens.length)throw new Error('表达式包含多余的符号。');
  return result.d===1n?String(result.n):`${result.n}/${result.d}`;
}

export function sameNumber(a,b){try{return calculate(`(${a})-(${b})`)==='0';}catch{return false;}}
