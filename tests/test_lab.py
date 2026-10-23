import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'lab'))
from run import grade
from add_documents import variant


class LabTests(unittest.TestCase):
    def setUp(self):
        self.case=json.loads((ROOT/'lab/task.json').read_text())
        self.result={'status':'finished','answer':'51768','citations':['calc:1'],'trace':[{'action':{'action':'calculate'},'observation':{'ok':True,'id':'calc:1','value':'51768'}}]}

    def test_task_contract_requires_observed_matching_calculation(self):
        self.assertTrue(grade(self.case,self.result)['task_success'])
        for references in ([],['calc:99'],['inventory-current']):
            result=copy.deepcopy(self.result);result['citations']=references
            score=grade(self.case,result)
            self.assertTrue(score['answer_correct'])
            self.assertFalse(score['citations_ok'])
            self.assertFalse(score['task_success'])

    def test_finished_state_is_part_of_success(self):
        result=copy.deepcopy(self.result);result['status']='time_budget_exhausted'
        self.assertTrue(grade(self.case,result)['answer_correct'])
        self.assertFalse(grade(self.case,result)['task_success'])

    def test_wrong_formula_can_pass_consistency_but_fail_answer(self):
        result=copy.deepcopy(self.result);result['answer']='50352';result['trace'][0]['observation']['value']='50352'
        score=grade(self.case,result)
        self.assertTrue(score['citations_ok'])
        self.assertFalse(score['answer_correct'])

    def test_direct_answer_without_calculation_can_pass(self):
        result=copy.deepcopy(self.result);result['trace']=[];result['citations']=[]
        self.assertTrue(grade(self.case,result)['task_success'])

    def test_document_variants_preserve_answer_and_move_current_record(self):
        for position,index in [('start',0),('middle',10),('end',20)]:
            result=variant(self.case,20,position,False)
            self.assertEqual(len(result['documents']),21)
            self.assertEqual(list(result['documents']).index('inventory-current'),index)
            self.assertEqual(result['expected'],self.case['expected'])
        self.assertEqual(len(variant(self.case,20,older=True)['documents']),22)

    def test_scripted_commands_and_budget_failure(self):
        for args,expected_status,steps,returncode in [([], 'finished',3,0),(['--fail-first','calculate'],'finished',4,0),(['--fail-first','calculate','--steps','3'],'step_budget_exhausted',3,1)]:
            result=subprocess.run([sys.executable,str(ROOT/'lab/run.py'),*args],capture_output=True,text=True)
            data=json.loads(result.stdout)
            self.assertEqual(result.returncode,returncode)
            self.assertEqual(data['status'],expected_status)
            self.assertEqual(data['decision_steps'],steps)
            self.assertEqual(data['model_calls'],0)


if __name__=='__main__':unittest.main()
