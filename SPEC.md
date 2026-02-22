# Skill Tools Specification

**Version:** 1.0.0

**Status:** Draft

## 1. Introduction

Skill Tools is a standard for bundling executable tools with AI agent skills. A skill is a folder containing instructions (as a markdown file) and, optionally, one or more callable tools declared in a JSON manifest with handler scripts.

The goal is simple: skills should be able to *do things*, not just *describe things*.

```
skills/count-words/
  SKILL.md              # Instructions for the agent
  tools.json            # Tool declarations
  scripts/
    count_words.js      # Executable handler
```

When an agent runtime loads this skill, it registers `count_words` as a callable tool. The agent can invoke it directly — no subprocess, no server, no protocol negotiation.

## 2. Motivation

AI agent skills today are typically instruction-only: a markdown file that tells the agent *how* to do something. The agent still needs to translate those instructions into tool calls, shell commands, or API requests on its own.

On the other end of the spectrum, MCP (Model Context Protocol) provides a full client-server architecture for exposing tools. This is powerful but heavy — it requires running a server process, managing connections, and adding dependencies.

Skill Tools fills the gap between these two extremes:

| Approach | Executable? | Dependencies | Complexity |
|----------|-------------|--------------|------------|
| Plain skills (SKILL.md only) | No | None | Minimal |
| **Skill Tools** | **Yes** | **None** | **Low** |
| MCP servers | Yes | Runtime + SDK | High |

Skill Tools are **files, not servers**. They are portable across runtimes, require zero dependencies, and can be version-controlled, shared, and composed like any other files.

## 3. Terminology

- **Skill** — A directory containing a `SKILL.md` file with instructions for an AI agent. Follows the [Agent Skills](https://agentskills.io/) format.
- **Tool** — A callable function that an agent can invoke during a conversation. Declared in `tools.json` with a name, description, parameters, and handler script.
- **Handler** — A script or module that implements a tool. Receives arguments as a JSON object and returns a JSON-serializable result.
- **Manifest** — The `tools.json` file that declares which tools a skill provides.
- **Runtime** — The agent framework that discovers skills, registers tools, and executes handlers.

## 4. Directory Layout

A skill with tools follows this structure:

```
<skill-name>/
  SKILL.md                # Required. Skill instructions.
  tools.json              # Required for Skill Tools. Tool declarations.
  scripts/
    <tool_name>.<ext>     # One handler per tool.
```

- The skill directory name MUST follow the [Agent Skills](https://agentskills.io/specification) naming rules: lowercase letters, numbers, and hyphens only, max 64 characters, no consecutive hyphens, must not start or end with a hyphen. The directory name MUST match the `name` field in `SKILL.md` frontmatter.
- `SKILL.md` uses YAML frontmatter for metadata and markdown for the body, per the [Agent Skills](https://agentskills.io/) format.
- `tools.json` MUST be at the root of the skill directory.
- Handler scripts SHOULD live in a `scripts/` subdirectory.
- Handler file extensions signal the language (e.g., `.js`, `.py`, `.sh`). The runtime uses the extension to determine how to execute the handler.
- A skill MAY declare zero tools (instruction-only) or multiple tools.

Skills without a `tools.json` are valid instruction-only skills. The presence of `tools.json` is what makes a skill a Skill Tool.

## 5. Tool Manifest (`tools.json`)

The manifest is a JSON file containing an array of tool declarations.

### Schema

```json
[
  {
    "name": "tool_name",
    "description": "What the tool does",
    "script": "scripts/tool_name.js",
    "parameters": {
      "param1": {
        "type": "string",
        "description": "Description of param1"
      },
      "param2": {
        "type": "number",
        "description": "Description of param2"
      }
    }
  }
]
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Tool name. Lowercase with underscores (e.g., `count_words`). Must match `^[a-z][a-z0-9_]*$`. |
| `description` | string | Yes | Human-readable description of what the tool does. Shown to the agent in the tools list. |
| `script` | string | No | Relative path from the skill directory to the handler script. If omitted, the runtime SHOULD provide a stub that tells the agent to load the skill for instructions. |
| `parameters` | object | No | Parameter definitions. Each key is a parameter name, each value is a property definition. Defaults to `{}` (no parameters). |

### Parameter Definitions

Each parameter follows a subset of JSON Schema, matching the format used by OpenAI and Anthropic for function calling:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | string | Yes | JSON Schema type: `string`, `number`, `boolean`, `object`, `array`. |
| `description` | string | Yes | Human-readable description shown to the agent. |
| `enum` | array | No | Allowed values for the parameter. |
| `optional` | boolean | No | If `true`, the parameter is not required. Default: `false`. |

Parameters without `"optional": true` are treated as required.

### Validation Rules

- The manifest MUST be valid JSON.
- The manifest MUST be an array (even for a single tool).
- Each tool MUST have a `name` and `description`.
- Tool names MUST be unique within a single manifest.
- Tool names SHOULD be unique across all skills loaded by an agent. If there is a conflict, the runtime SHOULD use the tool from the last-loaded skill (allowing overrides).

## 6. Handler Contract

A handler is an executable script that implements a tool. The contract is language-agnostic — any language that can receive JSON input and produce JSON output can be used.

### Interface

Every handler MUST satisfy this contract:

1. **Input** — Receive a single JSON object containing all tool parameters plus `__workDir` (the agent's working directory, injected by the runtime).
2. **Output** — Return a JSON-serializable value (string, object, array, number, boolean).
3. **Errors** — If the handler fails, the runtime SHOULD catch the error and return `{ "error": "<message>" }` to the agent.

How the runtime delivers input and collects output depends on the handler language. The `script` field's file extension signals which convention to use.

### JavaScript Convention (Reference)

JavaScript handlers are ECMAScript modules (ESM) that export a default async function. This is the reference convention used in all spec examples.

```js
export default async function handler(args) {
  const { __workDir: workDir, param1, param2 } = args;
  // ... tool logic ...
  return result;
}
```

The runtime imports the module and calls the default export directly (in-process).

### Python Convention

Python handlers are modules that define a `handler` function. The runtime calls the script with the JSON-encoded args object.

```python
import json, sys

def handler(args):
    work_dir = args.get("__workDir")
    text = args.get("text", "")
    words = text.split()
    return {"count": len(words)}

if __name__ == "__main__":
    args = json.loads(sys.argv[1]) if len(sys.argv) > 1 else json.load(sys.stdin)
    print(json.dumps(handler(args)))
```

Runtimes MAY invoke Python handlers in-process (e.g., via an embedded interpreter) or as a subprocess. When using subprocess execution, the runtime passes the args JSON as stdin or as a command-line argument, and reads the result from stdout.

### Other Languages

Runtimes MAY support additional languages. The general pattern for subprocess-based handlers:

1. The runtime serializes the args object to JSON.
2. The runtime executes the script, passing args via stdin or command-line argument.
3. The handler writes its JSON result to stdout.
4. The runtime parses the stdout as JSON and returns it to the agent.

### Restrictions

Handlers SHOULD follow these constraints for portability:

1. **Minimize external dependencies.** Prefer standard library modules.
2. **No global state.** Each invocation should be independent.
3. **No side effects beyond the workspace.** File operations should stay within `__workDir`.
4. **Return meaningful results.** The agent needs to understand what happened.

### Secrets and Configuration

Handlers that need API keys or other secrets SHOULD read them from environment variables. Secrets MUST NOT be stored in the skill directory or committed to version control.

The skill's `SKILL.md` SHOULD document which environment variables are required:

```markdown
## Configuration

Set the following environment variable before using this skill:

- `OPENAI_API_KEY` — Your OpenAI API key
```

The runtime or deployment environment is responsible for providing these variables. This keeps skills portable — the same skill works in any environment that sets the required variables.

### Examples

**JavaScript:**

```js
export default async function handler(args) {
  const { text } = args;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return { count: words.length };
}
```

**Python:**

```python
def handler(args):
    text = args.get("text", "")
    words = text.split()
    return {"count": len(words)}
```

## 7. Discovery

Runtimes SHOULD discover Skill Tools by scanning skill directories for `tools.json` files.

### Discovery Algorithm

1. For each skill directory, read `SKILL.md` to get skill metadata (name, description).
2. Check if `tools.json` exists in the skill directory.
3. If it exists, parse it and attach the tool declarations to the skill metadata.
4. At agent startup, iterate all discovered skills and register their tools.

### Registration

For each tool in a skill's manifest:

1. Validate that `name` and `description` are present. Skip the tool with a warning if not.
2. If `script` is specified, resolve it relative to the skill directory and load the handler module.
3. If `script` is not specified, create a stub handler.
4. Register the tool on the agent with its name, description, parameters, and handler.

### Skill Directories

Runtimes MAY support multiple skill directory locations. A recommended set:

```
skills/
.opencode/skills/
.claude/skills/
.agents/skills/
```

If the same skill name appears in multiple directories, later directories override earlier ones.

## 8. Runtime Tool Creation (Optional)

Runtimes MAY support dynamic tool creation, allowing agents to define new tools during a session.

### `define_tool`

A meta-tool that creates a new tool at runtime:

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Tool name (lowercase with underscores) |
| `description` | string | What the tool does |
| `parameters` | string | JSON string of parameter definitions |
| `code` | string | Handler function body (language depends on runtime) |
| `persistent` | string | `"true"` to save as a Skill Tool on disk |

When `persistent` is `"true"`, the runtime saves the tool following the Skill Tools directory layout:

1. Convert the tool name to a skill name: underscores to hyphens (e.g., `fetch_weather` -> `fetch-weather`).
2. Create the skill directory: `skills/<skill-name>/`.
3. Write `SKILL.md` with auto-generated frontmatter and body.
4. Write `tools.json` with the tool declaration.
5. Write the handler script (e.g., `scripts/<tool_name>.js`) with the code wrapped in the appropriate module format for the runtime's language.

This ensures that dynamically created tools follow the same format as hand-authored ones.

### `remove_tool`

A meta-tool that removes a previously defined tool:

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | string | Tool name to remove |

Runtimes SHOULD protect standard/built-in tools from removal.

## 9. Relationship to Agent Skills

Skill Tools **extends** the [Agent Skills](https://agentskills.io/) format. It does not replace it.

- `SKILL.md` remains the primary artifact. Its format is unchanged.
- `tools.json` is an additive file. Skills without it are valid instruction-only skills.
- Skill metadata (name, description) still lives in the YAML frontmatter of `SKILL.md`.
- The `allowed-tools` frontmatter field (experimental, from Agent Skills) lists pre-approved tools a skill may use. With Skill Tools, a skill can now *provide* tools in addition to consuming them.
- The `compatibility` frontmatter field can document environment requirements for skills that bundle tools (e.g., "Requires Python 3.10+" or "Requires network access").

An Agent Skills runtime that does not support Skill Tools simply ignores `tools.json` and `scripts/`. Backward compatibility is preserved.

## 10. Relationship to MCP

Skill Tools and MCP (Model Context Protocol) solve different problems and are complementary.

| | Skill Tools | MCP |
|---|---|---|
| **Architecture** | Files (manifest + scripts) | Client-server (JSON-RPC) |
| **Runtime** | In-process function calls | Separate server process |
| **Dependencies** | None (standard library) | MCP SDK + transport |
| **Setup** | Drop files in a directory | Configure and run a server |
| **Use case** | Simple, portable tools bundled with skills | Complex integrations, external services, shared tooling |
| **Discoverability** | File system scan | Server registration |

Use Skill Tools when:
- The tool is self-contained and stateless.
- You want zero-dependency portability.
- The tool ships alongside skill instructions.
- You want agents to create and persist their own tools.

Use MCP when:
- The tool requires a persistent connection or session state.
- Multiple agents need to share the same tool server.
- The tool integrates with external services that need authentication flows.
- You need the full MCP ecosystem (prompts, resources, sampling).

Both can coexist. An agent runtime can support Skill Tools for simple file-based tools and MCP for complex integrations.

## 11. Security Considerations

Skill Tools execute code on the agent's host. This carries inherent risk, as does any agent system that runs tools or shell commands.

Runtimes SHOULD consider the following:

- **Trust boundary.** Only load skills from trusted sources. A malicious `tools.json` + handler can execute arbitrary code.
- **Sandboxing.** Run handlers in isolated environments where possible (containers, VMs, restricted permissions).
- **Confirmation.** Consider prompting the user before executing tools from newly added or untrusted skills.
- **Logging.** Record tool invocations and results for auditing.
- **Least privilege.** Handlers should only have access to the resources they need. The `__workDir` convention encourages scoping file operations to the workspace.

These concerns are not unique to Skill Tools — they apply equally to MCP servers, shell access, and any agent tool execution. The Agent Skills integration guide discusses similar recommendations for script execution.
