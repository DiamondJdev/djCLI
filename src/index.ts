import { Command } from "commander";
import { runCommand } from "./commands/run.js";
import { initCommand } from "./commands/init.js";
import { skillCommand } from "./commands/skill.js";
import { doctorCommand } from "./commands/doctor.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { installCommand, removeCommand, execCommand } from "./commands/pm.js";
import { depsCommand } from "./commands/deps.js";
import { tidyCommand } from "./commands/tidy.js";
import { deployCommand } from "./commands/deploy/index.js";
import { printAsciiArt } from "./utils/ascii.js";
import packageJson from "../package.json" with { type: "json" };

const args = process.argv.slice(2);
const hasHelpFlag = args.includes("-h") || args.includes("--help");
const hasNoArgs = args.length === 0;

if (hasHelpFlag || hasNoArgs) {
  printAsciiArt();
  console.log();
}

const program = new Command()
  .name("dj")
  .description("dj, the opinionated CLI wrapper")
  .enablePositionalOptions()
  .version(
    "v" + packageJson.version,
    "-v, --version",
    "output the current version",
  );

program.addCommand(runCommand);
program.addCommand(initCommand);
program.addCommand(skillCommand);
program.addCommand(doctorCommand);
program.addCommand(upgradeCommand);
program.addCommand(installCommand);
program.addCommand(removeCommand);
program.addCommand(execCommand);
program.addCommand(depsCommand);
program.addCommand(tidyCommand);
program.addCommand(deployCommand);

// If no command was provided, add delay before showing help
if (hasNoArgs) {
  program.outputHelp();
  process.exit(0);
} else {
  program.parse(process.argv);
}
