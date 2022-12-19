const path = require('node:path');
const { promises: Fs, createReadStream } = require('node:fs');
const os = require('node:os');

const log = console.log;
const logError = console.error;

const startingDir = os.homedir();
const username = getUsername();
let currentDir = startingDir;

const OS_FLAGS = {
  'EOL': 'EOL',
  'cpus': 'cpus',
  'homedir': 'homedir',
  'username': 'username',
  'architecture': 'architecture',
};

const getMsg = {
  welcome: () => `Welcome to the File Manager, ${username}!`,
  goodbye: () => `Thank you for using File Manager, ${username}, goodbye!`,
  cwd: () => `You are currently in ${currentDir}`,
  errInput: () => `Invalid input`,
  errOperation: () => `Operation failed`,
};

const commands = {
  ['.exit']: () => {
    log(getMsg.goodbye());
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
    const names = (await Fs.readdir(currentDir)).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    const statPromises = names.map(name => Fs.stat(path.resolve(currentDir, name)));
    const results = await Promise.allSettled(statPromises);
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
  ['os']: async (flag) => {
    const osCommands = {
      [OS_FLAGS.EOL]: () => os.EOL,
      [OS_FLAGS.cpus]: () => os.cpus(),
      [OS_FLAGS.homedir]: () => os.homedir(),
      [OS_FLAGS.username]: () => os.userInfo().username,
      [OS_FLAGS.architecture]: () => os.arch(),
    };

    const data = osCommands[flag]();
    log(data);
  },
  ['cat']: async (filePath) => {
    const maybeFilePath = path.resolve(currentDir, filePath);
    const stream = createReadStream(maybeFilePath);
    stream.setEncoding('utf8');
    try {
      for await (const chunk of stream) {
        log(chunk);
      }
    } catch (err) {
      throw Error(err);
    }
  },
  ['add']: async (fileName) => {
    const fullPath = path.resolve(currentDir, `${fileName}`);
    try {
      await Fs.writeFile(fullPath, '', {
        flag: 'wx'
      });
    } catch (err) {
      throw Error(err);
    }
  }
};

const validateArgs = {
  ['.exit']: args => ({
    isValid: args === '',
  }),
  ['up']: args => ({
    isValid: args === '',
  }),
  ['cd']: (args) => {
    return {
      isValid: (args !== '' && typeof args === 'string'),
      args,
    };
  },
  ['ls']: args => ({
    isValid: args === '',
  }),
  ['os']: args => {
    const trimmed = args.trim().slice('--'.length);
    const flag = Object.keys(OS_FLAGS).find(flag => flag === trimmed);
    return {
      isValid: !!flag,
      args: flag,
    };
  },
  ['cat']: args => ({
    isValid: args !== '',
    args,
  }),
  ['add']: args => ({
    isValid: args !== '',
    args,
  }),
};

function start() {
  log(getMsg.welcome());
  log(getMsg.cwd());

  process.stdin.on('data', async (data) => {
    const input = data.toString();
    let cmd;
    try {
      cmd = parseCmd(input)
    } catch (err) {
      logError(err)
      log(getMsg.errInput());
    }

    try {
      cmd && await cmd()
    } catch (err) {
      logError(err)
      log(getMsg.errOperation());
    }

    log(getMsg.cwd());
  });

  process.on('SIGINT', commands['.exit']);
};


function parseCmd(str) {
  const name = Object.keys(commands).find(cmd => str.startsWith(cmd));
  if (!name) throw Error();

  const inputArgs = str.slice(name.length).trim();
  const { isValid, args } = validateArgs[name](inputArgs);
  if (!isValid) throw Error();

  return commands[name].bind({}, args);
};

function getUsername() {
  const args = process.argv.slice(2);
  const nameArg = args.find(arg => arg.startsWith('--username='));
  return nameArg?.slice('--username='.length).trim() || 'Anonymus';
};

start();
