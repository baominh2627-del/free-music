import fs from 'node:fs';

const SUPABASE_URL = 'https://bwngunlfuocytgmqnvxa.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ME4uw-ONInKAh0XfJBzI_A_vKBRk2OF';

async function checkExact() {
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hoangnotee28072007@gmail.com', password: '28072007' })
  });
  const auth = await loginRes.json();
  const pl = auth.user.user_metadata?.playlists?.[0];
  console.log('Playlist in metadata:', pl.title, '| Track IDs count:', pl.trackIds.length);

  const tracksRes = await fetch(`${SUPABASE_URL}/rest/v1/pink_tune_tracks?select=id,title,artist`, {
    headers: { 'apikey': PUBLISHABLE_KEY, 'Authorization': `Bearer ${PUBLISHABLE_KEY}` }
  });
  const allTracks = await tracksRes.json();
  const map = new Map(allTracks.map(t => [t.id, t]));

  const playlist74 = JSON.parse(fs.readFileSync('danh_sach_74_bai_spotify.json', 'utf8'));

  console.log('Checking 1-to-1 match between danh_sach_74_bai_spotify.json and playlist trackIds...');
  let mismatches = 0;
  for (let i = 0; i < playlist74.length; i++) {
    const expected = playlist74[i].title;
    const actualId = pl.trackIds[i];
    const actual = map.get(actualId);
    if (!actual) {
      console.log(`Missing track ID: ${actualId}`);
      mismatches++;
    } else {
      const expNorm = expected.toLowerCase().slice(0, 10);
      const actNorm = actual.title.toLowerCase();
      if (!actNorm.includes(expNorm) && !expNorm.includes(actNorm)) {
        console.log(`Mismatch at ${i+1}: expected "${expected}", got "${actual.title}"`);
        mismatches++;
      }
    }
  }
  console.log('Total mismatches:', mismatches);
}

checkExact().catch(console.error);
