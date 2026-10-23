import fs from 'node:fs';

const SUPABASE_URL = 'https://bwngunlfuocytgmqnvxa.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ME4uw-ONInKAh0XfJBzI_A_vKBRk2OF';

function norm(s) {
  return (s || '').toLowerCase().trim();
}

async function verify() {
  console.log('=== KIỂM TRA TOÀN DIỆN HỆ THỐNG PINK TUNE ===\n');

  // 1. Fetch all tracks from Supabase
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pink_tune_tracks?select=id,title,artist,storage_path,cover_path&order=created_at.desc`, {
    headers: { 'apikey': PUBLISHABLE_KEY, 'Authorization': `Bearer ${PUBLISHABLE_KEY}` }
  });
  const allTracks = await res.json();
  console.log(`📊 Tổng số bài hát đang có trên thư viện cộng đồng Pink Tune: ${allTracks.length} bài`);

  // 2. Check Korean playlist (45 tracks)
  const koreanList = JSON.parse(fs.readFileSync('danh_sach_nhac_han.json', 'utf8'));
  let koreanFound = 0;
  const koreanMissing = [];

  koreanList.forEach(k => {
    const kn = norm(k.title);
    const found = allTracks.find(t => {
      const tn = norm(t.title);
      return tn === kn || tn.startsWith(kn) || kn.startsWith(tn) || tn.includes(kn) || kn.includes(tn);
    });
    if (found) {
      koreanFound++;
    } else {
      koreanMissing.push(k);
    }
  });

  console.log(`\n🇰🇷 Playlist Nhạc Hàn: ${koreanFound}/${koreanList.length} bài đã có trên Supabase`);
  if (koreanMissing.length > 0) {
    console.log('Các bài chưa tìm thấy:', koreanMissing.map(m => m.title));
  } else {
    console.log('✅ TẤT CẢ 45 BÀI NHẠC HÀN ĐÃ ĐƯỢC ĐĂNG ĐẦY ĐỦ 100%!');
  }

  // 3. Check Spotify 74 playlist
  const list74 = JSON.parse(fs.readFileSync('danh_sach_74_bai_spotify.json', 'utf8'));
  let found74 = 0;
  list74.forEach(p => {
    const pn = norm(p.title);
    const found = allTracks.find(t => {
      const tn = norm(t.title);
      return tn === pn || tn.startsWith(pn) || pn.startsWith(tn) || tn.includes(pn) || pn.includes(tn);
    });
    if (found) found74++;
  });
  console.log(`\n🇻🇳 Playlist "làm Tí không bạn!!?!!": ${found74}/${list74.length} bài đã có trên Supabase`);

  // 4. Check hoangnotee28072007@gmail.com user playlist
  console.log('\n👤 Kiểm tra tài khoản hoangnotee28072007@gmail.com...');
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'hoangnotee28072007@gmail.com', password: '28072007' })
  });
  const auth = await loginRes.json();
  if (auth.user) {
    const playlists = auth.user.user_metadata?.playlists || [];
    console.log(`✅ Đăng nhập thành công! User ID: ${auth.user.id}`);
    console.log(`📋 Số lượng playlist trong tài khoản: ${playlists.length}`);
    playlists.forEach(pl => {
      console.log(`   - "${pl.title}": ${pl.trackIds?.length} bài hát (ID: ${pl.id})`);
    });
  } else {
    console.error('❌ Không đăng nhập được tài khoản hoangnotee:', auth);
  }
}

verify().catch(console.error);
