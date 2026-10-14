// Builds the app and puts it on the droplet:
//
//   npm run deploy
//
// Runs the tests first. Each deploy is a new folder in
// /srv/whip-tracker/releases; `current` is switched to it and the app
// restarts, which takes a second or two. Open pages reconnect by themselves
// and offer to reload. The five newest releases are kept for rolling back
// (see deploy/README.md).
//
// Signs in over SSH as john with the key in DEPLOY_KEY (default ~/.ssh/jcvc).
// john owns /srv/whip-tracker, and restarting the app is an admin command he
// can run without his sudo password, so nothing here asks for it.

import { execFileSync } from 'node:child_process'
import { rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HOST = process.env.DEPLOY_HOST ?? 'john@162.243.220.182'
const KEY = process.env.DEPLOY_KEY ?? path.join(os.homedir(), '.ssh', 'jcvc')
const SSH = ['-i', KEY, '-o', 'StrictHostKeyChecking=accept-new']
const release = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
const archive = 'release.tgz'

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts })

process.chdir(path.resolve(import.meta.dirname, '..'))

console.log('Testing and building…')
// The npm that's running this script, so it works the same from PowerShell and Git Bash.
const npm = (...args) => (process.env.npm_execpath ? run(process.execPath, [process.env.npm_execpath, ...args]) : run('npm', args, { shell: true }))
npm('test')
npm('run', 'build')

console.log(`Uploading release ${release}…`)
run('tar', ['-czf', archive, 'dist', 'dist-server'])
try {
  run('scp', [...SSH, archive, `${HOST}:/tmp/whip-tracker-${release}.tgz`])
} finally {
  rmSync(archive, { force: true })
}

console.log('Switching over…')
const script = `
set -euo pipefail
dir=/srv/whip-tracker/releases/${release}
mkdir -p "$dir"
tar -xzf /tmp/whip-tracker-${release}.tgz -C "$dir" --no-same-owner
rm /tmp/whip-tracker-${release}.tgz
chmod -R a+rX "$dir"
ln -sfn "$dir" /srv/whip-tracker/current
sudo -n systemctl restart whip-tracker
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -fs -o /dev/null http://127.0.0.1:3102/api/health && break
  sleep 1
done
if ! curl -fsS -o /dev/null http://127.0.0.1:3102/api/health; then
  echo "The app didn't start. Its last log lines:"
  journalctl -u whip-tracker -n 30 --no-pager
  exit 1
fi
ls -1dt /srv/whip-tracker/releases/* | tail -n +6 | xargs -r rm -rf
echo "Deployed ${release}."
`
run('ssh', [...SSH, HOST, 'bash', '-s'], { input: script, stdio: ['pipe', 'inherit', 'inherit'] })
