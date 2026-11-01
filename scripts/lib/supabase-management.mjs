// Administrative access only. Secrets are held in process memory, never logged.
import { execFileSync } from 'node:child_process';
const project = 'aycdtkpiuptagwhcvwrt';
let token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token && process.platform === 'darwin') {
  token = execFileSync('security', ['find-generic-password', '-s', 'Supabase CLI', '-a', 'supabase', '-w'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  if (token.startsWith('go-keyring-base64:')) token = Buffer.from(token.slice(18), 'base64').toString();
}
if (!token) throw new Error('Authenticate Supabase CLI or set SUPABASE_ACCESS_TOKEN locally.');
export async function query(sql, parameters = []) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql, parameters }),
  });
  if (!response.ok) throw new Error(`Database management query failed: HTTP ${response.status}`);
  return response.json();
}
