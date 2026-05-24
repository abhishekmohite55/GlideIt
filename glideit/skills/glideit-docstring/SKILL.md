---
name: glideit-docstring
description: Scans the entire codebase and writes short, accurate docstrings for all functions, methods, classes, and components that are missing them — in whatever language and docstring format is appropriate.
version: 1.0.0
trigger: /glideit-docstring
author: GlideIt
---

# GlideIt Docstring Writer

## What this skill does

GlideIt is a codebase visualization tool. It parses your project and renders every function, class, and component as a node in an interactive call graph. Each node card can display a description — but only if the function has a docstring.

This skill scans your entire codebase, identifies every function, method, class, and component that is missing a docstring, and writes one for each. It handles any programming language — detect the language and use its standard docstring format automatically. After this skill runs, re-run `glideit run` to regenerate the visualization with populated descriptions on every node.

---

## How to use

```
/glideit-docstring
```

Or, if you have a knowledge base or architecture document:

```
/glideit-docstring use ARCHITECTURE.md for context
```

---

## Agent Instructions

You are the GlideIt Docstring Writer. When triggered, follow every step below in order. Do not skip steps. Do not do anything beyond what these steps describe.

---

### Step 1 — Check for a knowledge base

Before touching any code, look in the project root for any of the following (in order of preference):

- A file explicitly passed by the user as an argument
- `ARCHITECTURE.md`, `knowledge-base.md`, `codebase.md`
- `docs/architecture.md`, `docs/overview.md`
- `README.md` (as a last resort)

If one exists, read it first. Use it to understand module responsibilities, naming conventions, and project structure. This makes your docstrings more accurate and reduces how many source files you need to open.

---

### Step 2 — Explore the codebase

Walk all source files in the project. Include every file whose language supports inline documentation (docstrings, JSDoc, XML docs, block comments used as documentation, etc.).

**Skip these directories entirely:**

- `node_modules/`, `__pycache__/`, `.venv/`, `venv/`, `dist/`, `build/`, `glideit-out/`, `.git/`

**Skip these file types:**

- Test files (`test_*`, `*_test`, `*.test.*`, `*.spec.*`)
- Minified files (`*.min.js`)
- Type declaration files (`*.d.ts`)
- Generated or compiled output files

---

### Step 3 — Detect language and docstring format

For each file, detect its language. Use that language's standard docstring or documentation comment format. You already know what the correct format is for each language — use your judgment. Do not ask the user. Do not default to a single format across all files.

---

### Step 4 — Decide what needs a docstring

For each function, method, class, or component, apply this filter:

**Write a docstring if:**
- It has no existing docstring or documentation comment
- Its body contains meaningful logic (medium short, and informative)

**Do NOT write a docstring if:**
- It already has any form of docstring or documentation comment — leave it completely untouched
- It is a trivial one-liner (e.g. a simple getter/setter with no logic)
- It is a constructor that only assigns parameters with no other logic
- It is inside a test file

---

### Step 5 — Write the docstrings

For each item that needs a docstring, read its full body. Write a docstring that describes what it **actually does** — not a restatement of its name.

**Constraints — strictly enforced:**

- **Length:** 1 sentence maximum. 2 sentences only if the function is genuinely complex and 1 sentence would be misleading. Never more than 2 sentences.
- **Content:** Describe behaviour and purpose. No parameter lists, no return type descriptions, no usage examples, no TODO notes.
- **Accuracy:** Read the body. Do not guess from the name alone.
- **No overwrites:** Never modify, append to, or touch an existing docstring.
- **No other changes:** The only edit you make to any file is inserting the docstring. Do not rename, reformat, refactor, or fix anything else.
- **No placeholders:** Never write "TODO", "Description needed", or vague filler. If you genuinely cannot determine what a function does, skip it.

---

### Step 6 — Report

After completing all edits, output this summary:

```
GlideIt Docstring Writer — Complete

Files modified:   N
Docstrings added: M

Skipped: K items
  - Already had docstrings: A
  - Trivial / excluded:     B

Next step: run `glideit run` to regenerate the visualization.
```

---

## Knowledge Base

Pass a `.md` knowledge file as an argument to improve accuracy and reduce token usage:

```
/glideit-docstring use my-knowledge-base.md
```

The agent reads it before exploring source files, so it understands your architecture upfront rather than inferring everything from code alone.
