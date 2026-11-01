// Administrative tool only. Never import into the application runtime.
import { query } from './lib/supabase-management.mjs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const command = process.argv[2] || 'verify';
if (!['migrate', 'import', 'import-history', 'verify'].includes(command)) throw new Error('Use migrate, import, import-history or verify.');
if (command === 'migrate') {
  const root = path.resolve('supabase/migrations');
  for (const file of (await readdir(root)).filter(f => /^\d+.*\.sql$/.test(f)).sort()) {
    await query(await readFile(path.join(root, file), 'utf8'));
    console.log(`Applied ${file}`);
  }
}
if (command === 'import' || command === 'import-history') {
  const root = process.env.APP_REVIEW_CACHE_DIR || path.resolve('src/data/app-cache');
  let count = 0;
  for (const file of command === 'import-history' ? [] : (await readdir(root)).filter(f => /^[a-z]{2}-\d+\.json$/.test(f))) {
    const page = JSON.parse(await readFile(path.join(root, file), 'utf8'));
    if (!page.app?.id || !page.app?.country || !page.updatedAt) throw new Error(`Invalid report: ${file}`);
    const key = `${page.app.country.toLowerCase()}-${page.app.id}`;
    await query(`INSERT INTO public.app_review_pages(cache_key,country,app_id,payload,generated_at,updated_at)
      VALUES($1,$2,$3,$4::jsonb,$5::timestamptz,$6::timestamptz)
      ON CONFLICT(cache_key) DO UPDATE SET payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at
      WHERE app_review_pages.updated_at <= EXCLUDED.updated_at`,
    [key,page.app.country,page.app.id,JSON.stringify(page),page.generatedAt || page.updatedAt,page.updatedAt]);
    const verified = await query('SELECT payload = $2::jsonb AS matches FROM public.app_review_pages WHERE cache_key=$1', [key,JSON.stringify(page)]);
    if (!verified[0]?.matches) throw new Error(`Report differs or cloud has a newer copy: ${key}`);
    count++;
  }
  console.log(`Verified imported reports: ${count}; local originals retained.`);
  const historyRoot = process.env.APP_REVIEW_HISTORY_DIR || path.join(root, '.review-history');
  const historyFiles = await readdir(historyRoot).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  let historyCount = 0;
  for (const file of historyFiles.filter(f => /^[a-z]{2}-\d+\.json$/.test(f))) {
    const history = JSON.parse(await readFile(path.join(historyRoot, file), 'utf8'));
    const key = file.replace(/\.json$/, '');
    await query(`INSERT INTO public.app_review_history(cache_key,payload,updated_at)
      VALUES($1,$2::jsonb,$3::timestamptz) ON CONFLICT(cache_key) DO UPDATE
      SET payload=EXCLUDED.payload,updated_at=EXCLUDED.updated_at
      WHERE app_review_history.updated_at <= EXCLUDED.updated_at`,
    [key, JSON.stringify(history), history.lastSeenAt]);
    const verified = await query('SELECT payload = $2::jsonb AS matches FROM public.app_review_history WHERE cache_key=$1', [key,JSON.stringify(history)]);
    if (!verified[0]?.matches) throw new Error(`History differs or cloud has a newer copy: ${key}`);
    historyCount++;
  }
  console.log(`Verified imported histories: ${historyCount}; local originals retained.`);
}
console.log(JSON.stringify(await query(`SELECT tablename,rowsecurity,
  has_table_privilege('anon',format('public.%I',tablename),'SELECT') AS anon_select,
  has_table_privilege('service_role',format('public.%I',tablename),'INSERT') AS server_insert
  FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'app_review_%' ORDER BY tablename`), null, 2));
