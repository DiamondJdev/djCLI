import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import { Command } from "commander";
import { select } from "@inquirer/prompts";
import { parse as parseEnv } from "dotenv";
import chalk from "chalk";

export function parsePackageJSON(): { scripts: Record<string, string> } {
  const filePath = path.join(process.cwd(), "package.json");
  let data: string;
  try {
    data = fs.readFileSync(filePath, "utf-8");
  } catch {
    throw new Error("package.json not found in current directory");
  }

  const pkg = JSON.parse(data) as { scripts?: Record<string, string> };

  if (!pkg.scripts || Object.keys(pkg.scripts).length === 0) {
    throw new Error("No scripts found in package.json");
  }

  return { scripts: pkg.scripts };
}

export function findMatchingScripts(
  scripts: Record<string, string>,
  name: string,
): string[] {
  if (name in scripts) return [name];
  return Object.keys(scripts).filter((key) => key.startsWith(name));
}

export function updateEnvFile(envValue: string): void {
  const envPath = path.join(process.cwd(), ".env");
  let envMap: Record<string, string> = {};

  try {
    const content = fs.readFileSync(envPath, "utf-8");
    envMap = parseEnv(content);
  } catch {
    // file doesn't exist; start with empty map
  }

  envMap["NODE_ENV"] = envValue;

  const content =
    Object.entries(envMap)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n";

  fs.writeFileSync(envPath, content);
}

function runNPMScript(scriptName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", scriptName], { stdio: "inherit" });

    const onSignal = (): void => {
      child.kill("SIGINT");
    };
    process.once("SIGINT", onSignal);

    child.on("close", (code) => {
      process.off("SIGINT", onSignal);
      if (code !== 0) {
        reject(new Error(`npm run ${scriptName} exited with code ${code}`));
      } else {
        resolve();
      }
    });

    child.on("error", (err) => {
      process.off("SIGINT", onSignal);
      reject(err);
    });
  });
}

export async function runAction(
  scriptName: string,
  options: { env?: string },
): Promise<void> {
  let pkg: { scripts: Record<string, string> };
  try {
    pkg = parsePackageJSON();
  } catch (err) {
    console.log(chalk.red(`Error: ${(err as Error).message}`));
    process.exit(1);
    return;
  }

  const matches = findMatchingScripts(pkg.scripts, scriptName);

  if (matches.length === 0) {
    console.log(chalk.red(`No script found matching '${scriptName}'`));
    console.log("\nAvailable scripts:");
    for (const name of Object.keys(pkg.scripts)) {
      console.log(`   • ${name}`);
    }
    process.exit(1);
    return;
  }

  let selectedScript: string;
  if (matches.length === 1) {
    selectedScript = matches[0];
  } else {
    console.log(`Found ${matches.length} matching scripts:`);
    selectedScript = await select({
      message: "Select a script to run:",
      choices: matches.map((s) => ({
        name: `${s}  (${pkg.scripts[s]})`,
        value: s,
      })),
    });
  }

  if (options.env) {
    try {
      updateEnvFile(options.env);
      console.log(chalk.green(`Set NODE_ENV=${options.env} in .env file`));
    } catch (err) {
      console.log(
        chalk.red(`Error updating .env file: ${(err as Error).message}`),
      );
      process.exit(1);
      return;
    }
  }

  console.log(`Running: npm run ${selectedScript}\n`);
  try {
    await runNPMScript(selectedScript);
  } catch (err) {
    console.log(chalk.red(`\nScript failed: ${(err as Error).message}`));
    process.exit(1);
  }
}

export const runCommand = new Command("run")
  .description("Run npm scripts intelligently with environment management")
  .argument("<script>", "Script name or prefix to run")
  .option(
    "--env <environment>",
    "Set NODE_ENV in .env file (e.g., development, production)",
  )
  .action(runAction);
