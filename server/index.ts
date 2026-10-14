import { serve } from '@hono/node-server'
import { app } from './app.ts'
import { startBackups } from './backup.ts'
import { ACCOUNTS_KEY, PORT } from './config.ts'
import { DB_PATH } from './db.ts'

/*
 * Starts the server. Settings are in config.ts. People are added on the
 * People page, or on the droplet with the accounts service's command:
 * `sudo accounts invite you@example.com --app whip-tracker --role admin`.
 */

if (!ACCOUNTS_KEY) console.warn('ACCOUNTS_KEY isn’t set, so nobody can sign in. See README.md.')
startBackups()
// Only this machine can reach it: in production, Caddy is the way in.
serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, () => console.log(`Whip Tracker server on http://127.0.0.1:${PORT} (database: ${DB_PATH})`))
