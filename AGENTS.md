WebCaster is an Electrobun-based app that lets you convert any RSS feed of text articles into a podcast feed with AI-narrated audio versions of the articles.

# Tools
- Use `bun` as the runtime and package manager.
- Use `bunx` to run npm scripts.

# Code style
- Rely on JavaScript's auto semicolon insertion; avoid semicolons.
- Use single quotes for data values.
- Use double quotes for imports and text that appears in the UI.
- Use `let` instead of `const` inside functions, unless doing so would cause an error.
- Prefer nesting over early returns.
- Don't wrap React components in parentheses.
- Use `==` for equality checks unless a strict comparison is required.
- Use 4 spaces for indentation.
- Put single line if statement on the next line with no braces.
- Organize files by feature, not by type.
- ALWAYS define functions below where they are used if possible, relying on hoisting.