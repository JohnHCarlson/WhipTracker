# The Whip Tracker on the droplet

The droplet itself (signing in as john, Caddy, Node, the firewall, adding a
project) is described in `D:\Dev\Election Night Dashboard\deploy\README.md`.
This app follows the same pattern.

```bash
ssh -i ~/.ssh/jcvc john@162.243.220.182
```

|  | Whip Tracker |
|---|---|
| Address | https://votes.jcvc.io |
| DNS (Cloudflare) | A record `votes` → 162.243.220.182, **DNS only** |
| Port on 127.0.0.1 | 3102 |
| Linux user | `whip-tracker` (no password, no shell) |
| Code | `/srv/whip-tracker/releases/<time>`; `current` points at the live one |
| Data | `/var/lib/whip-tracker` (votes, sign-in sessions, `backups/`) |
| Settings | `/etc/whip-tracker.env` (640, root:whip-tracker: holds the app's accounts key) |
| Service | `whip-tracker` (systemd) |
| Caddy | `/etc/caddy/sites/whip-tracker.caddy` |
| Password-free for john | `systemctl restart whip-tracker` (`/etc/sudoers.d/john-whip-tracker`) |

Accounts (emails, passwords, who can use what) aren't here. They're in the
accounts service (`D:\Dev\Accounts`, port 3100), which this app asks over
127.0.0.1 with its own key. The service must be installed first.

Ports in use: 3100 accounts, 3101 Election Night, 3102 Whip Tracker.

## First-time setup

1. Install and deploy the accounts service (see its deploy/README.md).
2. Copy this folder to the droplet and run the installer (asks for john's password):

   ```bash
   scp -i ~/.ssh/jcvc -r deploy john@162.243.220.182:whip-tracker-install
   ```

   ```bash
   ssh -t -i ~/.ssh/jcvc john@162.243.220.182 "sudo bash whip-tracker-install/install-app.sh"
   ```

3. Deploy: `npm.cmd run deploy` on the laptop. The app runs, but nothing
   outside the droplet can reach it yet.
4. **Going live.** In Cloudflare, point `votes` at 162.243.220.182 (an A record,
   DNS only) in place of GitHub Pages. Then give Caddy the site; it gets the
   certificate within seconds:

   ```bash
   ssh -t -i ~/.ssh/jcvc john@162.243.220.182 "sudo install -m 644 whip-tracker-install/whip-tracker.caddy /etc/caddy/sites/whip-tracker.caddy && sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile && sudo systemctl reload caddy && rm -r whip-tracker-install"
   ```

5. Turn off GitHub Pages for the repo (Settings → Pages), so GitHub stops
   claiming the name.

## Everyday commands

On the droplet, signed in as john:

```bash
journalctl -u whip-tracker -f          # live log (Ctrl+C to stop)
systemctl status whip-tracker          # running?
sudo systemctl restart whip-tracker
sudo accounts invite you@example.com --app whip-tracker --name "Your Name" --role admin   # a link to get in
```

People are otherwise managed on the site's People page.

## Rolling back to an earlier version

Each deploy keeps the five newest releases.

```bash
ls -1t /srv/whip-tracker/releases
ln -sfn /srv/whip-tracker/releases/<the one you want> /srv/whip-tracker/current
sudo systemctl restart whip-tracker
```

## Backups

The app copies its database to `/var/lib/whip-tracker/backups/` every five
minutes while anything changes, and before deleting a vote. It keeps the
newest 300. They live on the droplet only. To copy one to the laptop (the
first command asks for john's password):

```bash
ssh -t -i ~/.ssh/jcvc john@162.243.220.182 'sudo install -o john -m 600 /var/lib/whip-tracker/backups/<file> ~/'
```

```bash
scp -i ~/.ssh/jcvc "john@162.243.220.182:<file>" .
```

To put a backup back (this replaces everything since), on the droplet:

```bash
sudo ls /var/lib/whip-tracker/backups
sudo systemctl stop whip-tracker
sudo mkdir -p /var/lib/whip-tracker/replaced
sudo sh -c 'mv /var/lib/whip-tracker/votes.db* /var/lib/whip-tracker/replaced/'
sudo cp /var/lib/whip-tracker/backups/<file> /var/lib/whip-tracker/votes.db
sudo chown whip-tracker: /var/lib/whip-tracker/votes.db
sudo systemctl start whip-tracker
```

Open pages reconnect by themselves when the app comes back.
