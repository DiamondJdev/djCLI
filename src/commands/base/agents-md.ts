import type { BaseAnswers } from "./answers.js";
import { pmCommands } from "./package-manager.js";

export const DOCKER_TODO =
  "TODO: This project will run in Docker; add a Dockerfile before shipping";

export const CLAUDE_MD = "@AGENTS.md\n";

const GROWS = "Add entries here as the project grows.";

export function renderAgentsMd(a: BaseAnswers): string {
  const cmds = pmCommands(a.pm);
  const language = a.pm === "uv" ? "Python" : "TypeScript (Node.js)";
  const docker = a.docker ? `\n${DOCKER_TODO}\n` : "";

  return `# ${a.name}

${a.description}

- Language: ${language}
- Package manager: ${a.pm}
- Code lives in \`src/\`, tests in \`tests/\`, docs in \`docs/\`.
${docker}
## Commands

\`\`\`bash
${cmds.install}   # install dependencies
${cmds.test}   # run all tests
${cmds.singleTest}   # run one test file
\`\`\`

## Boundaries

Ask first before:

- changing the architecture or adding a new abstraction layer
- adding a dependency
- risky data or security work (auth, permissions, destructive data changes)

Never:

- log secrets, tokens or personal data
- push straight to \`main\`

Always:

- run the tests before saying a task is done, and say which ones you ran

## Execution loop

1. Read the relevant code and tests before editing.
2. For non-trivial work, state the plan briefly.
3. Make the smallest correct change that matches the existing code.
4. Verify it: run the tests, and the build or lint if the project has them.
5. Commit in small steps and open a PR.
6. Report what you verified and what you did not.

## Architecture

${GROWS}

## Environment variables

${GROWS}

## Learned facts

${GROWS}
`;
}
