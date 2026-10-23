"""Official Codex CLI transport, with existing ChatGPT login and no credential copying."""

import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import tempfile
import time


ACTION_SCHEMA = {
    "type": "object",
    "properties": {
        "action": {"type": "string", "enum": ["calculate", "search", "read", "finish"]},
        "argument": {"type": "string"},
        "answer": {"type": "string"},
        "citations": {"type": "array", "items": {"type": "string"}},
        "note": {"type": "string"},
    },
    "required": ["action", "argument", "answer", "citations", "note"],
    "additionalProperties": False,
}

DISABLED_FEATURES = [
    "shell_tool", "multi_agent", "apps", "plugins", "remote_plugin", "goals",
    "hooks", "image_generation", "browser_use", "computer_use", "memories",
]


class BackendError(RuntimeError):
    pass


class CodexBackend:
    def __init__(self, model="gpt-6.1-sol", effort="low", timeout=90):
        self.model, self.effort, self.timeout = model, effort, timeout
        self.cli_version = subprocess.check_output(["codex", "--version"], text=True).strip()

    def step(self, prompt: str, directory: Path, timeout: float | None = None) -> tuple[dict, dict]:
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "prompt.txt").write_text(prompt, encoding="utf-8")
        schema = directory / "action.schema.json"
        schema.write_text(json.dumps(ACTION_SCHEMA), encoding="utf-8")
        env = os.environ.copy()
        for key in ("OPENAI_API_KEY", "CODEX_API_KEY"):
            env.pop(key, None)
        with tempfile.TemporaryDirectory(prefix="agent-lab-model-") as workspace:
            command = [
                "codex", "exec", "--ignore-user-config", "--ephemeral", "--json",
                "--skip-git-repo-check", "--sandbox", "read-only", "--color", "never",
                "--model", self.model, "-c", f'model_reasoning_effort="{self.effort}"',
                "-c", 'forced_login_method="chatgpt"', "-c", 'web_search="disabled"',
                "--output-schema", str(schema.resolve()),
                "--output-last-message", str((directory / "action.json").resolve()),
                "-C", workspace,
            ]
            for feature in DISABLED_FEATURES:
                command += ["--disable", feature]
            command.append("-")
            (directory / "invocation.json").write_text(json.dumps({
                "argv": command, "cli_version": self.cli_version,
                "requested_model": self.model, "effort": self.effort,
                "prompt_sha256": hashlib.sha256(prompt.encode()).hexdigest(),
                "auth_method": "existing_chatgpt_login",
                "transport_note": "Codex CLI scaffold; not a raw model API",
            }, indent=2), encoding="utf-8")
            start = time.monotonic()
            process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                       stderr=subprocess.PIPE, text=True, env=env,
                                       start_new_session=True)
            timed_out = False
            try:
                stdout, stderr = process.communicate(prompt, timeout=min(self.timeout, timeout or self.timeout))
            except subprocess.TimeoutExpired:
                timed_out = True
                os.killpg(process.pid, signal.SIGKILL)
                stdout, stderr = process.communicate()
            except BaseException:
                os.killpg(process.pid, signal.SIGKILL)
                process.communicate()
                raise
            elapsed = time.monotonic() - start
        (directory / "events.jsonl").write_text(stdout, encoding="utf-8")
        (directory / "stderr.log").write_text(stderr, encoding="utf-8")
        usage, agent_messages, unexpected_tools, errors = {}, [], [], []
        for line in stdout.splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "turn.completed":
                usage = event.get("usage", {})
            if event.get("type") in ("turn.failed", "error"):
                errors.append(event)
            item = event.get("item", {})
            if event.get("type") == "item.completed" and item.get("type") == "agent_message":
                agent_messages.append(item.get("text", ""))
            if item.get("type") in ("command_execution", "mcp_tool_call", "web_search", "file_change"):
                unexpected_tools.append(item.get("type"))
        meta = {"elapsed_s": elapsed, "usage": usage, "unexpected_native_tools": unexpected_tools,
                "returncode": process.returncode, "timed_out": timed_out, "errors": errors}
        (directory / "transport.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
        if timed_out:
            raise BackendError(f"CLI timeout after {elapsed:.1f}s; partial trace preserved")
        if process.returncode or errors:
            raise BackendError(f"CLI failure; inspect {directory / 'stderr.log'} and events.jsonl")
        if unexpected_tools:
            raise BackendError("Native Codex tools were used; this trial cannot support the ablation")
        final_path = directory / "action.json"
        final_text = final_path.read_text() if final_path.exists() else (agent_messages[-1] if agent_messages else "")
        try:
            action = json.loads(final_text)
        except json.JSONDecodeError as exc:
            raise BackendError("No valid structured action; trace preserved") from exc
        if (not isinstance(action, dict)
                or set(action) != set(ACTION_SCHEMA["required"])
                or action.get("action") not in ACTION_SCHEMA["properties"]["action"]["enum"]
                or any(not isinstance(action.get(key), str) for key in ("argument", "answer", "note"))
                or not isinstance(action.get("citations"), list)
                or any(not isinstance(ref, str) for ref in action["citations"])):
            raise BackendError("Action failed local schema validation")
        return action, meta
