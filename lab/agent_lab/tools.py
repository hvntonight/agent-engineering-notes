"""Deterministic, bounded tools. Never execute model-generated code."""

import ast
from fractions import Fraction
import operator
import re


def calculate(expression: str) -> str:
    """Exact rational arithmetic over decimal literals and + - * / ()."""
    if not isinstance(expression, str) or len(expression) > 1500:
        raise ValueError("Expression must be a string of at most 1500 characters")
    tree = ast.parse(expression, mode="eval")
    if len(list(ast.walk(tree))) > 150:
        raise ValueError("Expression too complex")
    ops = {ast.Add: operator.add, ast.Sub: operator.sub,
           ast.Mult: operator.mul, ast.Div: operator.truediv}

    def visit(node):
        if isinstance(node, ast.Constant) and type(node.value) in (int, float):
            literal = ast.get_source_segment(expression, node)
            if not re.fullmatch(r"(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)", literal):
                raise ValueError("Only plain decimal literals are supported")
            value = Fraction(literal)
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            value = visit(node.operand) * (-1 if isinstance(node.op, ast.USub) else 1)
        elif isinstance(node, ast.BinOp) and type(node.op) in ops:
            value = ops[type(node.op)](visit(node.left), visit(node.right))
        else:
            raise ValueError("Unsupported syntax; use decimal literals and + - * / ()")
        if max(value.numerator.bit_length(), value.denominator.bit_length()) > 16000:
            raise ValueError("Number too large")
        return value

    value = visit(tree.body)
    return str(value.numerator) if value.denominator == 1 else str(value)


def search(documents: dict[str, str], query: str, limit: int = 5) -> list[dict]:
    """Tiny lexical baseline, deliberately replaceable with BM25 or embeddings."""
    words = set(re.findall(r"[\w-]+", query.lower()))
    ranked = []
    for doc_id, text in documents.items():
        haystack = f"{doc_id} {text}".lower()
        score = sum(word in haystack for word in words)
        if score:
            ranked.append((score, doc_id, text))
    ranked.sort(key=lambda row: (-row[0], row[1]))
    return [{"id": doc_id, "text": text, "score": score}
            for score, doc_id, text in ranked[:limit]]


class ToolWorld:
    def __init__(self, documents: dict[str, str], fail_first: str | None = None):
        self.documents = documents
        self.fail_first = fail_first
        self.failure_used = False
        self.calculations: dict[str, str] = {}
        self.exposed_documents: set[str] = set()
        self.count = 0

    def call(self, action: str, argument: str) -> dict:
        self.count += 1
        if action == self.fail_first and not self.failure_used:
            self.failure_used = True
            return {"ok": False, "error": "TEMPORARY_UNAVAILABLE", "retryable": True}
        try:
            if action == "calculate":
                result = calculate(argument)
                ref = f"calc:{len(self.calculations) + 1}"
                self.calculations[ref] = result
                return {"ok": True, "id": ref, "expression": argument, "value": result}
            if action == "search":
                hits = search(self.documents, argument)
                self.exposed_documents.update(hit["id"] for hit in hits)
                return {"ok": True, "hits": hits}
            if action == "read":
                text = self.documents[argument]
                self.exposed_documents.add(argument)
                return {"ok": True, "id": argument, "text": text}
            return {"ok": False, "error": "UNKNOWN_TOOL", "retryable": False}
        except (ValueError, SyntaxError, KeyError, ZeroDivisionError, RecursionError) as exc:
            return {"ok": False, "error": f"{type(exc).__name__}: {exc}", "retryable": False}


def evidence_check(answer: str, citations: list[str], world: ToolWorld) -> list[str]:
    """Check provenance/exact numeric consistency, NOT semantic truth or the gold answer."""
    errors = []
    known = world.exposed_documents | world.calculations.keys()
    for ref in citations:
        if ref not in known:
            errors.append(f"Unknown or unobserved citation: {ref}")
        if ref in world.calculations:
            try:
                same = Fraction(answer) == Fraction(world.calculations[ref])
            except (ValueError, ZeroDivisionError):
                same = False
            if not same:
                errors.append(f"Answer does not match cited calculation: {ref}")
    if answer != "INSUFFICIENT_EVIDENCE" and not citations:
        errors.append("A non-abstaining answer needs observed evidence")
    return errors
