# Plan for Centralizing Agent Instructions

Status: **implemented** — `AGENTS.md` is the canonical agent guide; per-tool stubs (`CLAUDE.md`, `.cursorrules`, etc.) link to it.

---

## 1. Overview and Goals

To prevent developer guidelines, command lists, and architecture rules from drifting, we want a **single source of truth** for all AI coding assistants. However, different mainstream agents look for different configuration files at startup. 

### Target Agents & Loading Behaviors
* **Claude Code / Claude CLI**: Automatically reads `CLAUDE.md` in the workspace root.
* **Cursor**: Automatically reads `.cursorrules` in the workspace root, or `.cursor/rules/*.mdc` files.
* **GitHub Copilot**: Automatically reads `.github/copilot-instructions.md`.
* **Grok Build CLI**: Looks for `GROK.md` or config files in root.
* **Gemini / Codex**: Scans for standard developer guidelines (like `README.md`, `.cursorrules`, or repository instructions).

---

## 2. Proposed Architecture

We will adopt a **"Central Hub & Pointer"** model:
1. **Central Hub (`AGENTS.md`)**: A single file in the root containing all guidelines, commands, layout maps, and persistence rules.
2. **Agent-Specific Pointers**: Small, standardized boilerplate files for each agent that instruct the agent to immediately load and follow the central `AGENTS.md` file.

```
                  +--------------------------------+
                  |           AGENTS.md            |
                  |     (Central Source of Truth)   |
                  +--------------------------------+
                                  ^
                                  | (Loads / References)
       +--------------------------+--------------------------+
       |                          |                          |
+--------------+           +--------------+           +--------------+
|  CLAUDE.md   |           | .cursorrules |           |   .github/   |
| (Claude CLI) |           |   (Cursor)   |           |    copilot-  |
|              |           |              |           | instructions |
+--------------+           +--------------+           +--------------+
```

### Why this works
AI agents are reasoning engines. When they initialize, they parse their designated startup configuration file first. By placing a high-priority system directive inside the pointer files telling the agent to read `AGENTS.md`, the agent will immediately use its file-viewing tools to load the centralized instructions on its first turn.

---

## 3. Implementation Plan

### Step 1: Create `AGENTS.md`
We will restore the original instructions from `CLAUDE.md` (Vite scripts, Svelte 5 runes architecture, local storage persistence schema) and place them inside `AGENTS.md` at the root of the project.

### Step 2: Establish the Pointers
We will write lightweight pointer files that link back to the central hub.

#### 1. Claude Code Pointer (`CLAUDE.md`)
```markdown
# Claude Instructions

CRITICAL: You must read the centralized guidelines in [AGENTS.md](AGENTS.md) immediately on startup. It contains the project commands, directory layout, and strict state persistence rules you must follow.
```

#### 2. Cursor Pointer (`.cursorrules`)
```markdown
# Cursor Rules

CRITICAL: You must read the centralized guidelines in [AGENTS.md](AGENTS.md) immediately on startup. It contains the project commands, directory layout, and strict state persistence rules you must follow.
```

#### 3. GitHub Copilot / Codex Pointer (`.github/copilot-instructions.md`)
```markdown
# Copilot Instructions

CRITICAL: You must read the centralized guidelines in [AGENTS.md](AGENTS.md) immediately on startup. It contains the project commands, directory layout, and strict state persistence rules you must follow.
```

#### 4. Grok Pointer (`GROK.md`)
```markdown
# Grok Instructions

CRITICAL: You must read the centralized guidelines in [AGENTS.md](AGENTS.md) immediately on startup. It contains the project commands, directory layout, and strict state persistence rules you must follow.
```

---

## 4. Advantages
* **Single Source of Truth**: You only edit `AGENTS.md` when dependencies, scripts, or architectural rules change.
* **No Redundant Files**: Eliminates 1,000+ lines of duplicate documentation in the repository.
* **Compatibility**: Retains out-of-the-box loading for every mainstream agent.
