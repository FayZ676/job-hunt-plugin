## Prompt files vs. code

`SKILL.md` and `references/*.md` are prompts, read by a model that already has the code. A line
earns its place only if the model would **act differently** because of it.

Cut it when the code prevents, refuses or reports the situation — an error message is documentation
of last resort. Cut internals the model never calls, and anything already said in another file, a
`--help`, or a thrown error.

Keep judgment the code cannot make, and anything whose failure is silent rather than loud.

Found one instance? Sweep every prompt file for its class before calling it done, including the
file just edited.
