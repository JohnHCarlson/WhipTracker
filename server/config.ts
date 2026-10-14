import fs from 'node:fs'
import path from 'node:path'

// Locally, the settings come from .env (not in git). On the droplet, and in tests, they're already set.
if (process.env.ACCOUNTS_KEY === undefined && fs.existsSync('.env')) process.loadEnvFile('.env')

/*
 * Settings, from the environment (on the droplet, /etc/whip-tracker.env;
 * locally, .env):
 *
 *   WHIP_PORT      port on 127.0.0.1 (default 3102)
 *   WHIP_DATA      folder for the database and backups (default ./data)
 *   ACCOUNTS_URL   the accounts service (default http://127.0.0.1:3100)
 *   ACCOUNTS_KEY   this app's key for it, from `accounts app-key whip-tracker`
 */

export const PRODUCTION = process.env.NODE_ENV === 'production'
export const PORT = Number(process.env.WHIP_PORT ?? 3102)
export const DATA_DIR = path.resolve(process.env.WHIP_DATA ?? 'data')
export const BACKUP_DIR = path.join(DATA_DIR, 'backups')
export const ACCOUNTS_URL = process.env.ACCOUNTS_URL ?? 'http://127.0.0.1:3100'
export const ACCOUNTS_KEY = process.env.ACCOUNTS_KEY ?? ''
/** This app's name in the accounts service. */
export const APP_ID = 'whip-tracker'
