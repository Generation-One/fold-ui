# Memory (Work)

> If Engram is not installed or configured in this project, see [github.com/Generation-One/engram](https://github.com/Generation-One/engram) for setup instructions.

Shared project memory for the Fold UI. Any agent on this project can read and write here. Store what helps future sessions: decisions, problems, solutions, key context.

## Core
Critical project knowledge. Never evicted. Decisions and lessons that shape all future work.
<!-- Max ~20. Managed by Engram during Sleep only. -->


## Conscious
Active project context. Scan before responding. Current priorities, active work, key people involved.
<!-- 36 max. Managed by Engram. Do not edit manually. -->


## Subconscious
Background project knowledge. Check when the conversation touches something relevant but not in conscious.
<!-- 36 max. Managed by Engram. Do not edit manually. -->


## Short-term
Recent session context. What just happened, what was decided.
<!-- 36 max. FIFO. Managed by Engram. Do not edit manually. -->

- [Include/exclude patterns UI](events/2026/02/19.md) -- added file filtering pattern fields to project creation and edit pages <!-- hits:0 -->
- [Pattern editing UX decision](concepts/decisions/pattern-editing-ux.md) -- newline-separated textareas for include/exclude patterns, converted to arrays for API <!-- hits:0 -->


## Archive
Notable project history that did not make Core but is worth surfacing.
<!-- No hard limit. Reviewed during Sleep. -->

## Recalling

1. Check conscious, subconscious, and short-term first (already in context)
2. If not there, pick the right Fold project from the table below
3. Use `memory_search` on the correct Fold instance with that project's slug. Write descriptive queries -- "how the API handles authentication errors" finds more than "auth error". Do not search all projects at once.
4. Read the returned file references for detail (use `file_read` with the project slug and path)

If you are not sure which project to search, check the **Use for** column in the table below.

## Fold projects

Fold is the semantic search layer. You may have multiple Fold instances connected (e.g. `pepper`, `claude.ai Fold Personal`), each with its own projects. The **Instance** column tells you which MCP server to call.

| Project | Instance | Slug | Local path | Use for |
|---------|----------|------|------------|---------|
| Fold (UI) | pepper | `fold-ui-3fa91b0e` | `ui/` | Frontend codebase and UI work memory |
| Fold (Server) | pepper | `fold-cf44694e` | `srv/` | Backend codebase, API contracts |
| Fold (Docs) | pepper | `fold-wiki-4ff26f00` | `docs/` | Documentation wiki |
| Engram | pepper | `engram-80401610` | -- | Engram templates, prompts, and docs |

## Remembering

### User triggers

When the user says any of the following, act immediately:

- **"remember this"** or **"remember everything"**: write a compressed summary of the conversation so far to `ui/engram/inbox/session-YYYY-MM-DD.md`, then spawn Engram with "Process ui/engram/inbox/session-YYYY-MM-DD.md". Include key decisions, findings, and context.
- **"remember [specific fact]"**: spawn Engram directly with "Remember: [the fact]". No file needed.
- **"remember what just happened"**: write a summary of the most recent topic to `ui/engram/inbox/recent-YYYY-MM-DD.md`, then spawn Engram with "Process ui/engram/inbox/recent-YYYY-MM-DD.md".

These are not suggestions. When the user says "remember", you act.

### Automatic

You can also spawn Engram when something worth keeping happens:

- Quick fact: `Spawn Engram: "Remember: we switched from MUI to Radix"`
- Session log: write to `ui/engram/inbox/`, then `Spawn Engram: "Process ui/engram/inbox/session.md"`
- With context: `Spawn Engram: "Key decisions were made in this session. Process ui/engram/inbox/planning.md"`

Engram handles everything: where to store it, file structure, deduplication, list updates. Give it enough context to make good decisions. Do not write memory files yourself.

### Before committing

Before any significant or final commit-and-push, run a "remember" pass first. Write a session summary to `ui/engram/inbox/`, spawn Engram, and **wait for Engram to report back** before committing. This ensures decisions, context, and rationale from the session are captured in memory before the code ships. Do not skip this for large changes.

### Prompting the user

Occasionally remind the user to remember things, especially:

- After a long stretch of work with many decisions or findings
- When the conversation has covered important context that is not yet in memory
- When the user shares transcripts, meeting notes, or planning documents
- Before the session ends naturally

A gentle prompt is enough: "There is a fair amount of context from this session -- want me to remember it?" Do not nag, but do not let significant work go unrecorded either.

### How to spawn

To spawn Engram, use the spawning pattern described in your agent configuration file (the Spawning section added during setup). The mechanism differs by platform -- see the platform-specific setup guide for details.

## Feedback

If you run into a problem with Engram -- a setup step that does not work on your platform, a missing feature, or behaviour that seems wrong -- open an issue at [github.com/Generation-One/engram/issues](https://github.com/Generation-One/engram/issues). The repo is public; any GitHub account can file issues.
