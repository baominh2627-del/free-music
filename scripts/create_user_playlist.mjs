import fs from 'node:fs';

const SUPABASE_URL = 'https://bwngunlfuocytgmqnvxa.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ME4uw-ONInKAh0XfJBzI_A_vKBRk2OF';

function norm(s) {
  return (s || '').toLowerCase().trim();
}

async function createPlaylistForUser() {
  console.log('1. Logging in as hoangnotee28072007@gmail.com...');
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'hoangnotee28072007@gmail.com',
      password: '28072007'
    })
  });
  const auth = await loginRes.json();
  if (!auth.access_token) throw new Error('Login failed: ' + JSON.stringify(auth));
  const user = auth.user;
  console.log(`✅ Logged in successfully! User ID: ${user.id}`);

  console.log('2. Fetching all tracks from Supabase...');
  const tracksRes = await fetch(`${SUPABASE_URL}/rest/v1/pink_tune_tracks?select=id,title,artist`, {
    headers: { 'apikey': PUBLISHABLE_KEY, 'Authorization': `Bearer ${PUBLISHABLE_KEY}` }
  });
  const allTracks = await tracksRes.json();

  console.log('3. Matching 74 tracks from playlist "làm Tí không bạn!!?!!"...');
  const playlist74 = JSON.parse(fs.readFileSync('danh_sach_74_bai_spotify.json', 'utf8'));

  const matchedTrackIds = [];
  playlist74.forEach(p => {
    const pn = norm(p.title);
    // 1st: exact match
    let found = allTracks.find(t => norm(t.title) === pn);
    // 2nd: starts with
    if (!found) {
      found = allTracks.find(t => norm(t.title).startsWith(pn) || pn.startsWith(norm(t.title)));
    }
    // 3rd: includes
    if (!found) {
      found = allTracks.find(t => norm(t.title).includes(pn) || pn.includes(norm(t.title)));
    }
    if (found) {
      matchedTrackIds.push(found.id);
    } else {
      console.warn('NOT FOUND:', p.title);
    }
  });

  console.log(`Matched ${matchedTrackIds.length}/${playlist74.length} tracks.`);

  const playlistId = 'pl-lam-ti-khong-ban-74';
  const newPlaylist = {
    id: playlistId,
    title: 'làm Tí không bạn!!?!!',
    ownerId: user.id,
    trackIds: matchedTrackIds,
    createdAt: Date.now()
  };

  console.log('4. Saving playlist to hoangnotee user_metadata on Supabase Auth...');
  const currentMetadata = user.user_metadata || {};
  const existingPlaylists = Array.isArray(currentMetadata.playlists) ? currentMetadata.playlists : [];
  
  const filtered = existingPlaylists.filter(p => p.id !== playlistId && p.title !== newPlaylist.title);
  filtered.unshift(newPlaylist);

  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'PUT',
    headers: {
      'apikey': PUBLISHABLE_KEY,
      'Authorization': `Bearer ${auth.access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      data: {
        ...currentMetadata,
        playlists: filtered
      }
    })
  });

  const updatedUser = await updateRes.json();
  if (updatedUser.id) {
    console.log(`🎉 [THÀNH CÔNG] Đã tạo danh sách phát "${newPlaylist.title}" (đúng ${matchedTrackIds.length}/74 bài hát) cho tài khoản hoangnotee28072007@gmail.com!`);
  } else {
    console.error('Lỗi lưu playlist:', updatedUser);
  }
}

createPlaylistForUser().catch(console.error);
