import { execSync } from "child_process";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";

export function filterBranches(output: string): string[] {
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter((branch) => branch !== "")
    .filter((branch) => !branch.startsWith("*"))
    .filter((branch) => branch !== "main" && branch !== "master");
}

export async function delBranchesAction(options: {
  dryRun: boolean;
  yes: boolean;
}): Promise<void> {
  const gitArgs = ["branch", "--merged"];
  const deleteFlag = "-d";

  console.log("Finding branches...");

  let output: string;
  try {
    output = execSync(`git ${gitArgs.join(" ")}`).toString();
  } catch {
    console.log(chalk.red("Error running git. Are you in a git repository?"));
    process.exit(1);
    return;
  }

  const branches = filterBranches(output);

  if (branches.length === 0) {
    console.log(chalk.green("No branches to delete"));
    return;
  }

  console.log(`\nFound ${branches.length} branch(es) to delete:`);
  for (const branch of branches) {
    console.log(`   • ${branch}`);
  }
  console.log();

  if (options.dryRun) {
    console.log("Dry-run mode: No branches were deleted");
    return;
  }

  if (!options.yes) {
    const confirmed = await confirm({
      message: "Delete these branches?",
      default: false,
    });
    if (!confirmed) {
      console.log(chalk.red("Deletion cancelled"));
      return;
    }
  }

  let deletedCount = 0;
  let failedCount = 0;
  const failedBranches: string[] = [];

  for (const branch of branches) {
    try {
      execSync(`git branch ${deleteFlag} ${branch}`);
      console.log(`Deleted: ${branch}`);
      deletedCount++;
    } catch {
      console.log(chalk.red(`Failed to delete branch ${branch}`));
      failedCount++;
      failedBranches.push(branch);
    }
  }

  console.log();
  if (deletedCount > 0) {
    console.log(chalk.green(`Successfully deleted ${deletedCount} branch(es)`));
  }
  if (failedCount > 0) {
    console.log(
      chalk.yellow(
        `Failed to delete ${failedCount} branch(es): ${failedBranches.join(", ")}`,
      ),
    );
  }
}

export const delBranchesCommand = new Command("del_branches")
  .description("Delete all merged git branches except main/master")
  .option("--dry-run", "Show what would be deleted without actually deleting")
  .option("-y, --yes", "Skip confirmation prompt and proceed with deletion")
  .action(delBranchesAction);
