/**
 * R-08 Test D (IP-axis + account decay recovery) — simulated-clock exercise
 * of the REAL login-security module. Patches Date.now before importing so
 * every internal time read is controllable; fast-forwards past the IP block
 * (15 min) and the account decay window (15 min) to prove automatic recovery
 * with zero manual intervention.
 *
 * Usage: bunx tsx scripts/r89-sim-clock.ts
 */
const realNow = Date.now.bind(Date);
let offsetMs = 0;
Date.now = () => realNow() + offsetMs;

async function main() {
  const m = await import('../src/lib/login-security');
  const EMAIL = 'sim-clock-account@test.local';
  const IP = '203.0.113.199';

  // ── IP axis: 30 rotating failures → block ──
  for (let i = 0; i < 30; i++) {
    m.recordLoginFailure(`rotate-${i}@test.local`, IP, 'WRONG_PASSWORD');
  }
  console.log('after 30 failures | same IP, attacked account :', JSON.stringify(m.checkLoginAllowed(EMAIL, IP)));
  console.log('                   | same IP, other account   :', JSON.stringify(m.checkLoginAllowed('other@test.local', IP)));
  console.log('                   | different IP entirely     :', JSON.stringify(m.checkLoginAllowed(EMAIL, '198.51.100.7')));

  // ── Fast-forward 16 minutes: block (15m) AND window (10m) expired ──
  offsetMs = 16 * 60 * 1000;
  console.log('16 min later     | same IP, fresh account    :', JSON.stringify(m.checkLoginAllowed('fresh@test.local', IP)));

  // ── Account axis: 5 failures lock, quiet period decays the counter ──
  offsetMs = 0;
  for (let i = 0; i < 5; i++) {
    m.recordLoginFailure('decay-test@test.local', '198.51.100.9', 'WRONG_PASSWORD');
  }
  console.log('account axis     | locked after 5 failures   :', JSON.stringify(m.checkLoginAllowed('decay-test@test.local', '198.51.100.9')));
  offsetMs = 16 * 60 * 1000;
  console.log('                 | after 16 min quiet        :', JSON.stringify(m.checkLoginAllowed('decay-test@test.local', '198.51.100.9')));
}

main().catch((e) => { console.error(e); process.exit(1); });
