#!/usr/bin/env bash
#
# One-time setup of the Whip Tracker on the droplet, after the accounts
# service is installed and deployed (D:\Dev\Accounts). Safe to run again.
# Run with sudo, from the folder holding these files:
#
#   sudo bash install-app.sh
#
# What it does:
#   - Makes a system user, whip-tracker, that the app runs as. It has no
#     password and no shell, and can only write to its data folder.
#   - Makes the app's key for the accounts service and puts it, with the other
#     settings, in /etc/whip-tracker.env, readable only by root and the app
#     (kept if it exists).
#   - Installs the service, so the app starts on boot and restarts if it stops.
#   - Lets john restart the app without his sudo password, so deploys work:
#     /etc/sudoers.d/john-whip-tracker.
#   - Gives john the code folder, so deploys need no other admin rights.
#
# It doesn't touch Caddy. Once votes.jcvc.io points at the droplet, put the
# site live (see deploy/README.md, "Going live"). The code arrives with the
# first `npm run deploy`, which also starts it.

set -euo pipefail
cd "$(dirname "$0")"

id whip-tracker >/dev/null 2>&1 || useradd --system --home-dir /var/lib/whip-tracker --no-create-home --shell /usr/sbin/nologin whip-tracker
mkdir -p /srv/whip-tracker/releases
chown -R john:john /srv/whip-tracker

if [ ! -f /etc/whip-tracker.env ]; then
  key=$(/usr/local/bin/accounts app-key whip-tracker)
  [ -n "$key" ] || { echo "Couldn't make a key. Is the accounts service installed and deployed?"; exit 1; }
  umask 027
  sed "s|^ACCOUNTS_KEY=.*|ACCOUNTS_KEY=$key|" whip-tracker.env > /etc/whip-tracker.env
  chown root:whip-tracker /etc/whip-tracker.env
  chmod 640 /etc/whip-tracker.env
fi
install -m 644 whip-tracker.service /etc/systemd/system/whip-tracker.service

rule=$(mktemp)
cat > "$rule" <<'EOF'
# Lets John's deploys restart the Whip Tracker without typing his password.
john ALL=(root) NOPASSWD: /usr/bin/systemctl restart whip-tracker
EOF
visudo -cf "$rule"
install -m 440 "$rule" /etc/sudoers.d/john-whip-tracker
rm "$rule"

systemctl daemon-reload
systemctl enable whip-tracker
echo "Installed. Deploy the app next (npm run deploy on the laptop)."
