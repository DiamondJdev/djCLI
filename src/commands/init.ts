import * as fs from "fs";
import * as path from "path";
import { execSync, execFileSync } from "child_process";
import { Command } from "commander";
import { input, confirm } from "@inquirer/prompts";
import chalk from "chalk";

export interface TemplateVariable {
  name: string;
  placeholder: string;
  prompt: string;
  default: string;
}

export interface TemplateConfig {
  name: string;
  description: string;
  gitUrl: string;
  variables: TemplateVariable[];
  postInitCommands: string[];
  nextSteps: string;
}

export const templateRegistry: Record<string, TemplateConfig> = {
  nest: {
    name: "nest",
    description: "NestJS backend template",
    gitUrl: "https://github.com/DiamondJdev/NestJSTemplate.git",
    variables: [
      {
        name: "PROJECT_NAME",
        placeholder: "{{PROJECT_NAME}}",
        prompt: "Project name",
        default: "my-nest-app",
      },
      {
        name: "AUTHOR",
        placeholder: "{{AUTHOR}}",
        prompt: "Author name",
        default: "DiamondJdev",
      },
      {
        name: "DESCRIPTION",
        placeholder: "{{DESCRIPTION}}",
        prompt: "Project description",
        default: "A NestJS backend application",
      },
    ],
    postInitCommands: ["npm i", "npm run build", "npm run dev"],
    nextSteps: `  1. cd into the project directory\n  2. Copy .env.example to .env and configure\n  3. Development server should be running automatically`,
  },
  react: {
    name: "react",
    description: "React frontend template with Vite",
    gitUrl: "https://github.com/DiamondJdev/react-template.git",
    variables: [
      {
        name: "PROJECT_NAME",
        placeholder: "{{PROJECT_NAME}}",
        prompt: "Project name",
        default: "my-react-app",
      },
      {
        name: "AUTHOR",
        placeholder: "{{AUTHOR}}",
        prompt: "Author name",
        default: "DiamondJdev",
      },
    ],
    postInitCommands: ["npm install"],
    nextSteps: `  1. cd into the project directory\n  2. Run 'npm run dev' to start development server`,
  },
  next: {
    name: "next",
    description: "Next.js full-stack template",
    gitUrl: "https://github.com/DiamondJdev/next-template.git",
    variables: [
      {
        name: "PROJECT_NAME",
        placeholder: "{{PROJECT_NAME}}",
        prompt: "Project name",
        default: "my-next-app",
      },
      {
        name: "AUTHOR",
        placeholder: "{{AUTHOR}}",
        prompt: "Author name",
        default: "DiamondJdev",
      },
    ],
    postInitCommands: ["npm install"],
    nextSteps: `  1. cd into the project directory\n  2. Copy .env.example to .env.local and configure\n  3. Run 'npm run dev' to start development server`,
  },
};

export function getTemplateConfig(name: string): TemplateConfig | undefined {
  return templateRegistry[name];
}

function validateTargetDir(targetDir: string): void {
  if (!targetDir) {
    throw new Error("Target directory cannot be empty");
  }
  if (targetDir.includes("..")) {
    throw new Error(
      "Target directory cannot contain parent directory references",
    );
  }
}

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".ts",
  ".jsx",
  ".tsx",
  ".json",
  ".md",
  ".txt",
  ".env",
  ".yml",
  ".yaml",
  ".toml",
  ".html",
  ".css",
  ".scss",
]);

export function substituteVariables(
  rootDir: string,
  variables: Record<string, string>,
): void {
  if (Object.keys(variables).length === 0) return;

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") continue;
        walk(fullPath);
        continue;
      }

      const ext = path.extname(entry.name);
      if (!TEXT_EXTENSIONS.has(ext) && ext !== "") continue;

      let content: string;
      try {
        content = fs.readFileSync(fullPath, "utf-8");
      } catch {
        continue;
      }

      let modified = false;
      let result = content;
      for (const [placeholder, value] of Object.entries(variables)) {
        if (result.includes(placeholder)) {
          result = result.replaceAll(placeholder, value);
          modified = true;
        }
      }

      if (modified) {
        try {
          fs.writeFileSync(fullPath, result);
        } catch {
          // skip files we can't write
        }
      }
    }
  }

  walk(rootDir);
}

export function substituteInFilename(
  filePath: string,
  variables: Record<string, string>,
): string {
  let result = filePath;
  for (const [placeholder, value] of Object.entries(variables)) {
    const safeValue = value.replace(/[^a-zA-Z0-9-_]/g, "-");
    result = result.replaceAll(placeholder, safeValue);
  }
  return result;
}

export async function initAction(
  templateName: string,
  targetDir: string,
  options: { force: boolean },
): Promise<void> {
  try {
    validateTargetDir(targetDir);
  } catch (error) {
    console.log(
      chalk.red(
        `Invalid target directory: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
    process.exit(1);
    return;
  }

  const templateConfig = getTemplateConfig(templateName);
  if (!templateConfig) {
    console.log(chalk.red(`Unknown template '${templateName}'`));
    console.log("\nAvailable templates:");
    for (const [name, cfg] of Object.entries(templateRegistry)) {
      console.log(`   • ${name} - ${cfg.description}`);
    }
    process.exit(1);
    return;
  }

  if (fs.existsSync(targetDir)) {
    if (!options.force) {
      console.log(chalk.yellow(`Directory '${targetDir}' already exists.`));
      const overwrite = await confirm({
        message: "Overwrite?",
        default: false,
      });
      if (!overwrite) {
        console.log(chalk.red("Initialization cancelled"));
        return;
      }
    }
    console.log(`Removing existing directory: ${targetDir}`);
    fs.rmSync(targetDir, { recursive: true });
  }

  console.log(`Creating directory: ${targetDir}`);
  fs.mkdirSync(targetDir, { recursive: true });

  console.log(`Cloning template from ${templateConfig.gitUrl}...`);
  try {
    execFileSync(
      "git",
      ["clone", "--depth", "1", templateConfig.gitUrl, targetDir],
      {
        stdio: "inherit",
      },
    );
  } catch {
    console.log(chalk.red("Failed to clone template"));
    fs.rmSync(targetDir, { recursive: true, force: true });
    process.exit(1);
    return;
  }

  const gitDir = path.join(targetDir, ".git");
  try {
    fs.rmSync(gitDir, { recursive: true });
  } catch {
    console.log(chalk.yellow("Warning: Failed to remove .git directory"));
  }

  const variables: Record<string, string> = {};
  if (templateConfig.variables.length > 0) {
    console.log("\nPlease provide values for template variables:");
    console.log("   (Press Enter to use default value)\n");

    const projectName = path.basename(targetDir);

    for (const variable of templateConfig.variables) {
      const defaultValue =
        variable.name === "PROJECT_NAME" &&
        projectName !== "." &&
        projectName !== ".."
          ? projectName
          : variable.default;

      const value = await input({
        message: `   ${variable.prompt}`,
        default: defaultValue,
      });

      variables[variable.placeholder] = value;
    }
  }

  if (Object.keys(variables).length > 0) {
    console.log("\nPerforming variable substitution...");
    substituteVariables(targetDir, variables);
  }

  if (templateConfig.postInitCommands.length > 0) {
    console.log("\nRunning post-initialization commands...");
    for (const cmd of templateConfig.postInitCommands) {
      console.log(`   Running: ${cmd}`);
      try {
        execSync(cmd, { cwd: targetDir, stdio: "inherit" });
      } catch {
        console.log(chalk.yellow(`Warning: Command failed: ${cmd}`));
      }
    }
  }

  console.log(
    chalk.green(`\nProject initialized successfully in ${targetDir}!`),
  );
  if (templateConfig.nextSteps) {
    console.log("\nNext steps:");
    console.log(templateConfig.nextSteps);
  }
}

export const initCommand = new Command("init")
  .description("Initialize a new project from a template")
  .argument("<template>", "Template name (nest, react, next)")
  .argument("<directory>", "Target directory")
  .option("--force", "Overwrite existing directory without confirmation")
  .action(initAction);
