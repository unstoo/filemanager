const path = require('node:path');
const { promises: Fs, createReadStream, createWriteStream } = require('node:fs');
const os = require('node:os');
const { pipeline } = require('node:stream/promises');
const crypto = require('node:crypto');
const zlib = require('node:zlib');


const log = console.log;
const logError = console.error;

const startingDir = os.homedir();
const username = getUsername();
let currentDir = startingDir;

const SECRET = 'secret';
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
      [OS_FLAGS.EOL]: () => JSON.stringify(os.EOL),
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
  },
  ['rm']: async (filePath) => {
    const maybePath = path.resolve(currentDir, `${filePath}`);
    try {
      await Fs.unlink(maybePath);
    } catch (err) {
      throw Error(err);
    }
  },
  ['rn']: async ([filePath, newName]) => {
    const maybePath = path.resolve(currentDir, filePath);
    const parsedPath = path.parse(maybePath);
    const renamedPath = path.format({
      name: newName,
      root: parsedPath.root,
      dir: parsedPath.dir,
    });
    await Fs.copyFile(maybePath, renamedPath, Fs.constants.COPYFILE_EXCL);
    await Fs.unlink(maybePath);
  },
  ['cp']: async ([pathToFile, newDirPath]) => {
    const maybeSourcePath = path.resolve(currentDir, pathToFile);
    const { name, ext } = path.parse(maybeSourcePath);
    const maybeDestPath = path.resolve(currentDir, newDirPath, name + ext);

    const source = createReadStream(maybeSourcePath);
    const dest = createWriteStream(path.normalize(maybeDestPath), {
      flags: 'wx+',
    });

    try {
      await pipeline(
        source,
        dest
      );
    } catch (err) {
      throw Error(err);
    }
  },
  ['mv']: async ([pathToFile, newDirPath]) => {
    const maybeSourcePath = path.resolve(currentDir, pathToFile);
    const { name, ext } = path.parse(maybeSourcePath);
    const maybeDestPath = path.resolve(currentDir, newDirPath, name + ext);

    const source = createReadStream(maybeSourcePath);
    const dest = createWriteStream(path.normalize(maybeDestPath), {
      flags: 'wx+',
    });

    try {
      await pipeline(
        source,
        dest
      );
    } catch (err) {
      throw Error(err);
    }
    await Fs.unlink(maybeSourcePath);
  },
  ['hash']: async (pathToFile) => {
    const maybePath = path.resolve(currentDir, pathToFile);
    const hash = crypto.createHash('sha256', SECRET);
    const readable = createReadStream(maybePath);

    readable.on('readable', () => {
      const data = readable.read();
      if (data)
        hash.update(data);
      else {
        log(`${hash.digest('hex')}`);
      }
    });
  },
  ['compress']: async ([pathToFile, destDir]) => {
    const maybeSourcePath = path.resolve(currentDir, pathToFile);
    const { name, ext } = path.parse(maybeSourcePath);
    const source = createReadStream(maybeSourcePath);

    const maybeDestPath = path.resolve(currentDir, destDir, name + ext + '.br');
    const dest = createWriteStream(path.normalize(maybeDestPath), {
      flags: 'wx+',
    });

    try {
      await pipeline(
        source,
        zlib.createBrotliCompress(),
        dest,
      );
    } catch (err) {
      throw Error(err);
    }
  },
  ['decompress']: async ([pathToFile, destDir]) => {
    const maybeSourcePath = path.resolve(currentDir, pathToFile);
    const { name, ext } = path.parse(maybeSourcePath);
    const source = createReadStream(maybeSourcePath);
    const removedBrExt = ext === '.br' ? '' : ext;
    const maybeDestPath = path.resolve(currentDir, destDir, name + removedBrExt);
    const dest = createWriteStream(path.normalize(maybeDestPath), {
      flags: 'wx+',
    });

    try {
      await pipeline(
        source,
        zlib.createBrotliDecompress(),
        dest,
      );
    } catch (err) {
      throw Error(err);
    }
  },
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
  ['rm']: args => ({
    isValid: args !== '',
    args,
  }),
  ['rn']: args => {
    const trimmed = args.trim();
    const first = trimmed[0];
    const quoteChar = [`"`, `'`].find(char => char === first);
    if (!quoteChar) {
      const splitArgs = trimmed.split(' ');
      return splitArgs.length === 2 ? {
        isValid: true,
        args: splitArgs,
      } : {
        isValid: false,
        args
      }
    }

    const quoteIndecies = [];
    trimmed.split('').forEach((char, index) => {
      if (char === quoteChar) quoteIndecies.push(index);
    })

    return quoteIndecies.length === 4 ? {
      isValid: true,
      args: [
        trimmed.slice(quoteIndecies[0] + 1, quoteIndecies[1]),
        trimmed.slice(quoteIndecies[2] + 1, quoteIndecies[3]),
      ],
    } : {
      isValid: false,
      args,
    };
  },
  ['cp']: args => validateArgs['rn'](args),
  ['mv']: args => validateArgs['rn'](args),
  ['hash']: args => validateArgs['cat'](args),
  ['compress']: args => validateArgs['rn'](args),
  ['decompress']: args => validateArgs['rn'](args),
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
      logErr(getMsg.errInput());
    }

    try {
      cmd && await cmd()
    } catch (err) {
      logErr(getMsg.errOperation());
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
