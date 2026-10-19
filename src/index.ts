import { Command } from "commander";
import { delBranchesCommand } from "./commands/del-branches.js";
import { cleanCommand } from "./commands/clean.js";
import { runCommand } from "./commands/run.js";
import { initCommand } from "./commands/init.js";
import { skillCommand } from "./commands/skill.js";
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
  .version(
    "v" + packageJson.version,
    "-v, --version",
    "output the current version",
  );

program.addCommand(delBranchesCommand);
program.addCommand(cleanCommand);
program.addCommand(runCommand);
program.addCommand(initCommand);
program.addCommand(skillCommand);

// If no command was provided, add delay before showing help
if (hasNoArgs) {
  program.outputHelp();
  process.exit(0);
} else {
  program.parse(process.argv);
}
