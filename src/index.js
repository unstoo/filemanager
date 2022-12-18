const path = require('node:path')

const startingDir = process.cwd();
let username;
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
    goUp();
    console.log(getMsg.cwd());
  },
  ['']: () => { },
};

function goUp() {
  currentDir = path.join(currentDir, '..');
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
      console.log(getMsg.errInput());
      return;
    }

    try {
      cmd()
    } catch (err) {
      console.error(err)
      console.log(getMsg.errOperation());
    }
  });

  process.on('SIGINT', () => {
    console.log(getMsg.goodbye());
    process.exit(0);
  });
}

function getUsername() {
  const args = process.argv.slice(2);
  const nameArg = args.find(arg => arg.startsWith('--username='));
  return nameArg.slice('--username='.length);
}

function parseCmd(str) {
  const tokens = str
    .trim()
    .split(' ')
    .map(strChunk => strChunk.replace(/\s/g, ''))
    .filter(token => token);
  const cmdName = tokens[0];
  const cmdArgs = tokens.slice(1);

  if (!commands[cmdName]) throw Error();

  return commands[cmdName];
}

start()
