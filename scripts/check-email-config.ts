import { db } from '../src/lib/db';

async function main() {
  const setting = await db.systemSetting.findUnique({
    where: { key: 'email_provider_config' },
  });
  if (!setting) {
    console.log('No email_provider_config found in DB.');
    process.exit(0);
  }
  console.log('Raw value from DB:');
  console.log(setting.value);
  console.log('\n--- Parsed ---');
  try {
    const parsed = JSON.parse(setting.value);
    console.log('provider:', parsed.provider);
    console.log('apiKey length:', parsed.apiKey?.length ?? 0);
    console.log('apiKey starts with:', parsed.apiKey?.slice(0, 7) ?? '(empty)');
    console.log('apiKey ends with:', parsed.apiKey?.slice(-4) ?? '(empty)');
    console.log('fromEmail:', parsed.fromEmail);
    console.log('fromName:', parsed.fromName);
    console.log('replyTo:', parsed.replyTo);

    // Check for common problems
    if (!parsed.apiKey) {
      console.log('\n⚠️  API KEY IS EMPTY!');
    } else if (parsed.apiKey.includes('•')) {
      console.log('\n⚠️  API KEY CONTAINS BULLET CHARACTERS (was masked then saved)!');
    } else if (parsed.apiKey !== parsed.apiKey.trim()) {
      console.log('\n⚠️  API KEY HAS LEADING/TRAILING WHITESPACE!');
    } else if (!parsed.apiKey.startsWith('re_')) {
      console.log('\n⚠️  API KEY DOES NOT START WITH "re_" — Resend keys always start with re_');
    } else {
      console.log('\n✓ API key looks valid (starts with re_, no whitespace, no bullets)');
    }
  } catch (e) {
    console.log('Failed to parse:', e);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
