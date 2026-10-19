import * as fs from "fs";
import { Command } from "commander";
import chalk from "chalk";
import { printAsciiArt } from "../utils/ascii.js";
import { baseTemplate } from "./base/index.js";
import type { InitOptions } from "./init/answers.js";
import { assertTargetUsable, emptyDir } from "./init/target.js";
import { cloned, type Template } from "./init/template.js";

// To add a template: add an entry. `cloned` covers a git repo with
// {{PROJECT_NAME}}, {{AUTHOR}} and {{DESCRIPTION}} placeholders.
export const templates: Record<string, Template> = {
  nest: cloned(
    "NestJS backend template",
    "https://github.com/DiamondJdev/NestJSTemplate.git",
    ["Copy .env.example to .env and configure it", "npm install", "npm run dev"],
  ),
  react: cloned(
    "React frontend template with Vite",
    "https://github.com/DiamondJdev/react-template.git",
    ["npm install", "npm run dev"],
  ),
  next: cloned(
    "Next.js full-stack template",
    "https://github.com/DiamondJdev/next-template.git",
    ["Copy .env.example to .env.local and configure it", "npm install", "npm run dev"],
  ),
  base: baseTemplate,
};

function findTemplate(name: string): Template {
  if (Object.hasOwn(templates, name)) return templates[name];
  const list = Object.entries(templates)
    .map(([key, t]) => `   • ${key} - ${t.description}`)
    .join("\n");
  throw new Error(`Unknown template '${name}'\n\nAvailable templates:\n${list}`);
}

function checkTargetDir(dir: string): void {
  if (!dir) {
    throw new Error("Invalid target directory: it cannot be empty");
  }
  if (dir.includes("..")) {
    throw new Error(
      "Invalid target directory: it cannot contain parent directory references",
    );
  }
}

export async function initAction(
  templateName: string,
  dir: string,
  options: InitOptions,
): Promise<void> {
  printAsciiArt();
  console.log();

  try {
    const template = findTemplate(templateName);
    checkTargetDir(dir);
    // Validate and ask everything before deleting or writing anything.
    if (!options.force) assertTargetUsable(dir);
    const plan = await template.prepare(dir, options);

    if (options.force && fs.existsSync(dir)) {
      console.log(`Removing existing contents of: ${dir}`);
      emptyDir(dir);
    }
    fs.mkdirSync(dir, { recursive: true });
    await plan.populate(dir);

    console.log(chalk.green(`\nProject initialized successfully in ${dir}!`));
    console.log("\nNext steps:");
    [`cd ${dir}`, ...plan.nextSteps].forEach((step, i) =>
      console.log(`  ${i + 1}. ${step}`),
    );
  } catch (error) {
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

export const initCommand = new Command("init")
  .description("Initialize a new project from a template")
  .argument("<template>", "Template name")
  .argument("<directory>", "Target directory")
  .option("--force", "Delete the existing contents of the directory first")
  .option("--name <name>", "Package name (default: directory name)")
  .option("--description <text>", "One-line project description")
  .option("-y, --yes", "Never prompt; use defaults for missing values")
  .option("--pm <pm>", "base: package manager (npm, pnpm, uv; default: pnpm)")
  .option("--docker", "base: project will run in Docker")
  .option("--no-git", "base: skip git init and .gitignore")
  .addHelpText(
    "after",
    `
Templates:
${Object.entries(templates)
  .map(([name, t]) => `  ${name.padEnd(10)} ${t.description}`)
  .join("\n")}
`,
  )
  .action(initAction);
