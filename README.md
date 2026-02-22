# Skill Tools

A standard for bundling executable tools with AI agent skills.

Skills tell agents *how* to do things. Skill Tools let skills *do* things — by packaging callable tools alongside instructions, as plain files.

```
skills/count-words/
  SKILL.md              # Instructions for the agent
  tools.json            # Tool declarations
  scripts/
    count_words.js      # Executable handler
```

No server. No dependencies. No protocol negotiation. Just files.

## The problem

AI agent skills today are instruction-only: a markdown file that tells the agent how to accomplish a task. The agent must translate those instructions into tool calls, shell commands, or API requests on its own.

MCP (Model Context Protocol) solves this with a full client-server architecture. It's powerful, but heavy — you need a running server process, an SDK, and connection management.

There's nothing in between.

## Skill Tools

Skill Tools fills the gap. A skill can bundle executable tools by adding two things:

1. **`tools.json`** — a manifest declaring each tool's name, description, parameters, and handler script
2. **`scripts/`** — handler scripts that implement the tools

When the agent runtime loads the skill, it registers the tools. The agent can call them directly — no subprocess, no server, no protocol negotiation.

The spec is **language-agnostic**. Handlers can be written in JavaScript, Python, shell, or any language the runtime supports. JavaScript is used as the reference convention in the examples.

| Approach | Executable? | Dependencies | Complexity |
|----------|-------------|--------------|------------|
| Plain skills (SKILL.md only) | No | None | Minimal |
| **Skill Tools** | **Yes** | **None** | **Low** |
| MCP servers | Yes | Runtime + SDK | High |

Skills without `tools.json` remain valid instruction-only skills. Backward compatibility is preserved.

## Quick example

Here's a complete Skill Tool that counts words in text:

**`skills/count-words/tools.json`**
```json
[
  {
    "name": "count_words",
    "description": "Count the number of words in a text string",
    "script": "scripts/count_words.js",
    "parameters": {
      "text": {
        "type": "string",
        "description": "The text to count words in"
      }
    }
  }
]
```

**`skills/count-words/scripts/count_words.js`**
```js
export default async function handler(args) {
  const { text } = args;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return { count: words.length };
}
```

That's it. The runtime loads `tools.json`, imports the handler, and registers `count_words` as a callable tool.

See the full example in [`examples/count-words/`](examples/count-words/).

## Why not MCP?

MCP is great for complex integrations — persistent connections, shared tool servers, external service authentication. Skill Tools is not a replacement for MCP.

But many agent tools are simple: read a file, call an API, transform data. For these, running a separate server process is unnecessary overhead. Skill Tools gives you:

- **Zero dependencies** — handlers use standard library only
- **Language-agnostic** — write handlers in JS, Python, shell, or any language
- **File-based portability** — copy a folder, gain a tool
- **Version control** — tools live alongside code, diffable and reviewable
- **Agent self-authoring** — agents can create and persist their own tools at runtime

Both approaches can coexist. Use Skill Tools for simple, portable tools bundled with skills. Use MCP for complex integrations that need a server.

## Specification

The full specification is in [**SPEC.md**](SPEC.md). It covers:

- Directory layout and naming conventions
- Tool manifest format (`tools.json`)
- Handler contract (input, output, language conventions)
- Discovery and registration algorithm
- Runtime tool creation (optional `define_tool` / `remove_tool`)
- Relationship to Agent Skills and MCP

## License

[MIT](LICENSE)
