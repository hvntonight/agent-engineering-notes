import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,sameNumber} from '../docs/assets/math.js';

test('decimal arithmetic is exact and reduces fractions',()=>{
  assert.equal(calculate('0.1+0.2'),'3/10');
  assert.equal(calculate('(1-5)/3'),'-4/3');
  assert.equal(calculate('411*152-11260+708-152'),'51768');
  assert.equal(calculate('411*152-11260+500-152'),'51560');
  assert.equal(calculate('9007199254740993*9007199254740997'),'81129638414606735738984533590021');
});
test('operator precedence and unary signs',()=>{
  assert.equal(calculate('2+3*4'),'14');
  assert.equal(calculate('-(2+3)*4'),'-20');
  assert.ok(sameNumber('3/10','0.3'));
});
test('rejects code, malformed expressions and division by zero',()=>{
  for(const input of ["__import__('os')",'fetch("x")','9**999999','1/0','1+','(2+3','2(3)','1.2.3','1e9'])assert.throws(()=>calculate(input),undefined,input);
});
test('bounded input and nesting',()=>{
  assert.throws(()=>calculate('1'.repeat(1501)));
  assert.throws(()=>calculate('('.repeat(70)+'1'+')'.repeat(70)));
  assert.throws(()=>calculate(Array(100).fill('1').join('+')));
});
