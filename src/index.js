const path = require('node:path')
const { promises: Fs } = require('node:fs')
const os = require('node:os')

const startingDir = os.homedir();
let username = 'Anonymous';
let currentDir = startingDir;

const getMsg = {
  welcome: () => `Welcome to the File Manager, ${username}!`,
  goodbye: () => `Thank you for using File Manager, ${username}, goodbye!`,
  cwd: () => `You are currently in ${currentDir}`,
  errInput: () => `Invalid input`,
  errOperation: () => `Operation failed`,
};

const commands = {
  ['.exit']: () => {
    console.log(getMsg.goodbye());
    process.exit(0);
  },
  ['up']: () => {
    currentDir = path.resolve(currentDir, '..');
  },
  ['cd']: async (argPath) => {
    const maybeDir = path.resolve(currentDir, argPath);
    const stat = await Fs.stat(maybeDir);
    const isDir = stat.isDirectory();
    // can't cd into a file
    // can't cd into a non-existing dir
    if (!isDir) throw Error();
    currentDir = maybeDir;
  },
  ['ls']: async () => {
    const names = await Fs.readdir(currentDir);
    const fileStats = names.map(name => Fs.stat(path.resolve(currentDir, name)));
    const results = await Promise.allSettled(fileStats);
    const folders = [];
    const files = [];
    results
      .filter(res => res.status === 'fulfilled')
      .forEach(({ value }, index) => {
        if (value.isDirectory()) {
          folders.push({
            Name: names[index],
            Type: 'directory',
          })
        } else {
          files.push({
            Name: names[index],
            Type: 'file',
          })
        }
      })
    console.table([
      ...folders,
      ...files,
    ]);
  },
};

const validateArgs = {
  ['.exit']: args => args == '',
  ['up']: args => args == '',
  ['cd']: (args) => {
    return args !== '' && typeof args === 'string';
  },
  ['ls']: args => args == '',
};

function start() {
  username = getUsername();
  console.log(getMsg.welcome());
  console.log(getMsg.cwd());


  process.stdin.on('data', async (data) => {
    const input = data.toString();
    let cmd;
    try {
      cmd = parseCmd(input)
    } catch (err) {
      console.error(err)
      console.log(getMsg.errInput());
    }

    try {
      cmd && await cmd()
    } catch (err) {
      console.error(err)
      console.log(getMsg.errOperation());
    }

    console.log(getMsg.cwd());
  });

  process.on('SIGINT', () => {
    console.log(getMsg.goodbye());
    process.exit(0);
  });
}


function parseCmd(str) {
  const name = Object.keys(commands).find(cmd => str.startsWith(cmd));
  if (!name) throw Error();

  const inputArgs = str.slice(name.length).trim();
  if (!validateArgs[name](inputArgs)) throw Error();

  return commands[name].bind({}, inputArgs);
}

function getUsername() {
  const args = process.argv.slice(2);
  const nameArg = args.find(arg => arg.startsWith('--username='));
  return nameArg.slice('--username='.length);
}

start()
