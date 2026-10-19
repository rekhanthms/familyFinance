// "Is this computer ready to build the app?"  Run:  node scripts/doctor.mjs   (or npm run doctor)
// Works on any Node 18 or newer. Prints PASS / FIX for each requirement, with what to do.
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';

const results = [];
const pass = (name, detail = '') => results.push({ ok: true, name, detail });
const fix = (name, detail) => results.push({ ok: false, name, detail });
const run = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
const atLeast = (have, need) => {
  for (let i = 0; i < 3; i++) {
    if ((have[i] ?? 0) !== (need[i] ?? 0)) return (have[i] ?? 0) > (need[i] ?? 0);
  }
  return true;
};

// Node: Angular 21 supports 20.19+, 22.12+ and 24+. We ask for 22.22.2 or 24 (what the project was built with).
const node = parse(process.version);
const nodeOk = node[0] >= 24 || (node[0] === 22 && atLeast(node, [22, 12, 0]));
if (node[0] >= 24 || (node[0] === 22 && atLeast(node, [22, 22, 2]))) pass('Node.js', process.version);
else if (nodeOk) pass('Node.js', `${process.version} (works; 22.22.2 or newer is what the project was tested with)`);
else fix('Node.js', `${process.version} is too old. Install the current LTS from https://nodejs.org (22.22.2 or newer, or 24), then reopen the terminal.`);

// npm: older 10.x versions crash while installing Angular projects.
const npm = run('npm --version');
if (!npm) fix('npm', 'Not found. It comes with Node.js; reinstall Node from https://nodejs.org');
else if (atLeast(parse(npm), [11, 0, 0])) pass('npm', npm);
else fix('npm', `${npm}. Version 10.9.x can fail on Angular installs. Run:  npm install -g npm@11.6.2`);

// Git is optional but useful.
const git = run('git --version');
git ? pass('Git (optional)', git.replace('git version ', '')) : pass('Git (optional)', 'not installed; fine for now, needed only if you use GitHub');

// Project files.
existsSync('package.json') ? pass('Project folder', 'package.json found') : fix('Project folder', 'Run this from inside the family-finance folder (where package.json is).');
existsSync('node_modules') ? pass('Dependencies', 'installed') : fix('Dependencies', 'Not installed yet. Run:  npm install   (takes a few minutes the first time)');

// Memory and disk (a build needs roughly 2 GB free RAM).
const freeGb = os.freemem() / 1024 ** 3;
const totalGb = os.totalmem() / 1024 ** 3;
freeGb >= 1.5
  ? pass('Memory', `${freeGb.toFixed(1)} GB free of ${totalGb.toFixed(1)} GB`)
  : fix('Memory', `${freeGb.toFixed(1)} GB free of ${totalGb.toFixed(1)} GB. Close the browser tabs and other programs, then retry. Builds still work, only slower.`);

// Port 4200 is where the dev server listens.
const portFree = await new Promise((resolve) => {
  const server = net.createServer().once('error', () => resolve(false)).once('listening', () => server.close(() => resolve(true)));
  server.listen(4200, '127.0.0.1');
});
portFree ? pass('Port 4200', 'free') : fix('Port 4200', 'Already in use, probably by an earlier ng serve. Close it, or run:  npx ng serve --port 4300');

console.log(`\nChecking this computer (${os.platform()} ${os.arch()}, Node ${process.version})\n`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FIX '}  ${r.name}${r.detail ? ' - ' + r.detail : ''}`);
const problems = results.filter((r) => !r.ok);
console.log(problems.length === 0 ? '\nReady. Run:  npm start   then open http://localhost:4200\n' : `\n${problems.length} thing(s) to fix above, then run this check again.\n`);
process.exit(problems.length === 0 ? 0 : 1);
