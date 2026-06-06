import { Command } from 'commander'
import { delBranchesCommand } from './commands/del-branches.js'
import { cleanCommand } from './commands/clean.js'
import { runCommand } from './commands/run.js'
import { initCommand } from './commands/init.js'

const program = new Command()
  .name('dj')
  .description("dj, the opinionated CLI wrapper")
  .version('1.1.2', '-v, --version', 'output the current version')

program.addCommand(delBranchesCommand)
program.addCommand(cleanCommand)
program.addCommand(runCommand)
program.addCommand(initCommand)

program.parse()
