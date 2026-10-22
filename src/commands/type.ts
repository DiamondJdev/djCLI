import { Command } from "commander";
import chalk from "chalk";

const SNIPPETS = [
  `const sum = (xs: number[]) =>\n  xs.reduce((a, b) => a + b, 0);`,
  `function debounce(fn, ms) {\n  let t;\n  return (...args) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...args), ms);\n  };\n}`,
  `def fib(n):\n    a, b = 0, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a`,
  `for (const [key, value] of Object.entries(obj)) {\n  console.log(\`\${key}=\${value}\`);\n}`,
  `if err != nil {\n\treturn fmt.Errorf("open %s: %w", path, err)\n}`,
  `SELECT name, COUNT(*) AS total\nFROM orders\nGROUP BY name\nORDER BY total DESC;`,
];

const BACKSPACE = new Set(["\x7f", "\b"]);
const CTRL_C = "\x03";
const ESC = "\x1b";

export interface TypingState {
  typed: string;
  keystrokes: number;
  errors: number;
}

export const initialState = (): TypingState => ({ typed: "", keystrokes: 0, errors: 0 });

export function applyKey(state: TypingState, target: string, key: string): TypingState {
  if (BACKSPACE.has(key)) return { ...state, typed: state.typed.slice(0, -1) };
  if (state.typed.length >= target.length) return state;

  const char = key === "\r" ? "\n" : key;
  const expected = target[state.typed.length];
  const correct = char === expected;
  // After a correct newline, skip the indentation so nobody has to type leading spaces.
  const indent = correct && char === "\n" ? target.slice(state.typed.length + 1).match(/^[ \t]*/)![0] : "";

  return {
    typed: state.typed + char + indent,
    keystrokes: state.keystrokes + 1,
    errors: state.errors + (correct ? 0 : 1),
  };
}

export function score(target: string, state: TypingState, ms: number) {
  const correctChars = [...state.typed].filter((ch, i) => ch === target[i]).length;
  const minutes = Math.max(ms, 1) / 60_000;
  const accuracy = state.keystrokes === 0 ? 100 : ((state.keystrokes - state.errors) / state.keystrokes) * 100;
  return { wpm: correctChars / 5 / minutes, accuracy };
}

function render(target: string, typed: string): string {
  return [...target]
    .map((ch, i) => {
      const shown = ch === "\n" ? "↵\n" : ch === "\t" ? "  " : ch;
      if (i === typed.length) return chalk.inverse(shown);
      if (i > typed.length) return chalk.dim(shown);
      return typed[i] === ch ? chalk.green(shown) : chalk.bgRed.white(shown);
    })
    .join("");
}

function play(target: string): Promise<void> {
  const { stdin, stdout } = process;
  let state = initialState();
  let startedAt = 0;

  const draw = () =>
    stdout.write(
      "\x1b[H\x1b[2J" + chalk.bold("dj type") + chalk.dim("  (Esc to quit)\n\n") + render(target, state.typed) + "\n",
    );

  return new Promise((resolve) => {
    const finish = (completed: boolean) => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      if (completed) {
        const { wpm, accuracy } = score(target, state, Date.now() - startedAt);
        const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
        stdout.write(`\n${chalk.bold(`${wpm.toFixed(0)} WPM`)}  ${accuracy.toFixed(0)}% accuracy  ${secs}s\n`);
      }
      resolve();
    };

    const onData = (data: string) => {
      if (data === CTRL_C || data === ESC) return finish(false);
      if (data.startsWith(ESC)) return; // arrow keys and other escape sequences
      for (const key of data) {
        if (key < " " && key !== "\r" && key !== "\n" && key !== "\t" && !BACKSPACE.has(key)) continue;
        if (!startedAt) startedAt = Date.now();
        state = applyKey(state, target, key);
      }
      draw();
      if (state.typed === target) finish(true);
    };

    stdin.setRawMode(true);
    stdin.setEncoding("utf8");
    stdin.resume();
    stdin.on("data", onData);
    draw();
  });
}

export const typeCommand = new Command("type")
  .description("typing speed game: type a code snippet as fast as you can")
  .action(async () => {
    if (!process.stdin.isTTY) {
      console.error(chalk.red("dj type needs an interactive terminal."));
      process.exit(1);
    }
    await play(SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)]);
  });
