import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SUPABASE_URL = 'https://bwngunlfuocytgmqnvxa.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ME4uw-ONInKAh0XfJBzI_A_vKBRk2OF';
const CLOUD_BUCKET = 'pink-tune-music';
const PYTHON_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
const FFMPEG_PATH = path.resolve('node_modules/ffmpeg-static/ffmpeg.exe');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': PUBLISHABLE_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'baominh2627@gmail.com',
      password: 'Cun01626345930@'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Login failed: ' + JSON.stringify(data));
  return { token: data.access_token, user: data.user, expiresAt: Date.now() + 3500 * 1000 };
}

async function getExistingTracks() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pink_tune_tracks?select=id,title,artist`, {
    headers: {
      'apikey': PUBLISHABLE_KEY,
      'Authorization': `Bearer ${PUBLISHABLE_KEY}`
    }
  });
  return res.json();
}

async function fetchTrackCover(uri) {
  const trackId = uri.replace('spotify:track:', '');
  try {
    const res = await fetch(`https://open.spotify.com/embed/track/${trackId}`);
    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
      const entity = data.props?.pageProps?.state?.data?.entity;
      const images = entity?.visualIdentity?.image || [];
      const best = images.find(img => img.maxWidth === 640) || images[0];
      if (best?.url) return best.url;
    }
  } catch(e) {
    console.error(`Failed cover for ${uri}:`, e.message);
  }
  return '';
}

async function fetchYoutubeLink(title, artists) {
  const cleanTitle = title.replace(/\(feat\.[^)]*\)/gi, '').replace(/\(OST[^)]*\)/gi, '').trim();
  const firstArtist = artists.split(',')[0].replace(/"/g, '').trim();
  const query = `${cleanTitle} ${firstArtist}`;
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const match = html.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match) {
      return `https://www.youtube.com/watch?v=${match[1]}`;
    }
  } catch(e) {
    console.error(`Failed YT for ${query}:`, e.message);
  }
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

async function uploadFile(token, bucketPath, fileBuffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${CLOUD_BUCKET}/${bucketPath}`, {
    method: 'POST',
    headers: {
      'apikey': PUBLISHABLE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': contentType,
      'x-upsert': 'false'
    },
    body: fileBuffer
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upload storage failed (${res.status}): ${err}`);
  }
}

async function insertTrack(token, payload) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pink_tune_tracks`, {
    method: 'POST',
    headers: {
      'apikey': PUBLISHABLE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Insert track failed (${res.status}): ${err}`);
  }
  return res.json();
}

function normalize(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function main() {
  const rawTracks = JSON.parse(fs.readFileSync('new_playlist_raw.json', 'utf8'));
  console.log(`=== BẮT ĐẦU XỬ LÝ PLAYLIST: List nhạc Hàn 🌷✨ (${rawTracks.length} bài) ===\n`);

  let auth = await login();
  console.log(`✅ Đã đăng nhập quản trị thành công (User ID: ${auth.user.id})`);

  const existing = await getExistingTracks();
  const existingSet = new Set(existing.map(t => normalize(t.title)));
  console.log(`📊 Hiện tại thư viện đã có ${existing.length} bài hát.\n`);

  // Phase 1: Build full metadata list
  console.log('--- GIAI ĐOẠN 1: Thu thập metadata (Ảnh bìa + Link YouTube) ---');
  const playlistData = [];
  for (let i = 0; i < rawTracks.length; i++) {
    const t = rawTracks[i];
    const num = i + 1;
    const title = t.title;
    const artists = t.subtitle.replace(/\u00a0/g, ' ');
    const uri = t.uri;

    process.stdout.write(`[${num}/${rawTracks.length}] Lấy info: ${title.slice(0, 30)}... `);
    const [coverUrl, ytUrl] = await Promise.all([
      fetchTrackCover(uri),
      fetchYoutubeLink(title, artists)
    ]);
    console.log(`Xong`);
    playlistData.push({
      number: num,
      title,
      artists,
      youtubeUrl: ytUrl,
      coverUrl
    });
    await sleep(200);
  }

  // Save metadata files
  fs.writeFileSync('danh_sach_nhac_han.json', JSON.stringify(playlistData, null, 2));

  let md = '# Danh sách bài hát từ Playlist Spotify: List nhạc Hàn 🌷✨\n\n';
  md += '| STT | Tên bài hát | Nghệ sĩ | Link YouTube | Link ảnh bìa |\n';
  md += '|:---:|:---|:---|:---:|:---:|\n';
  playlistData.forEach(item => {
    const t = item.title.replace(/\|/g, '-');
    const a = item.artists.replace(/\|/g, '-');
    md += `| ${item.number} | **${t}** | ${a} | [Xem YouTube](${item.youtubeUrl}) | [Xem ảnh bìa](${item.coverUrl}) |\n`;
  });
  fs.writeFileSync('DANH_SACH_NHAC_HAN.md', md, 'utf8');
  console.log('\n✅ Đã lưu danh sách vào DANH_SACH_NHAC_HAN.md và danh_sach_nhac_han.json');

  // Phase 2: Upload to Pink Tune
  console.log('\n--- GIAI ĐOẠN 2: Tự động tải nhạc và đẩy lên Pink Tune ---');
  const tempDir = path.resolve('temp_korean_upload');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < playlistData.length; i++) {
    const item = playlistData[i];
    const num = item.number;
    const title = item.title;
    const artists = item.artists;
    const ytUrl = item.youtubeUrl;
    const coverUrl = item.coverUrl;

    console.log(`\n--------------------------------------------------`);
    console.log(`[${num}/${playlistData.length}] "${title}" — ${artists}`);

    // Check if title or normalized title already in Supabase
    const norm = normalize(title);
    const alreadyExists = [...existingSet].some(ex => ex.includes(norm) || norm.includes(ex));
    if (alreadyExists) {
      console.log(`⏩ ĐÃ CÓ TRONG THƯ VIỆN, BỎ QUA.`);
      skipCount++;
      continue;
    }

    if (Date.now() > auth.expiresAt) {
      console.log('🔄 Làm mới token quản trị...');
      auth = await login();
    }

    const audioId = crypto.randomUUID();
    const coverId = crypto.randomUUID();
    const audioFilePath = path.join(tempDir, `${audioId}.mp3`);
    const coverFilePath = path.join(tempDir, `${coverId}.jpg`);

    try {
      console.log(`⏳ Đang tải MP3 từ YouTube (${ytUrl})...`);
      const ytCmd = `"${PYTHON_PATH}" -m yt_dlp --ffmpeg-location "${FFMPEG_PATH}" -x --audio-format mp3 --audio-quality 192k --no-playlist -o "${path.join(tempDir, `${audioId}.%(ext)s`)}" "${ytUrl}"`;
      execSync(ytCmd, { stdio: 'pipe' });

      // Small delay for Windows file lock release
      await sleep(1000);

      if (!fs.existsSync(audioFilePath)) throw new Error('Không tạo được file âm thanh');
      const audioBuffer = fs.readFileSync(audioFilePath);
      console.log(`  Audio size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      console.log(`⏳ Đang tải ảnh bìa...`);
      const coverRes = await fetch(coverUrl);
      const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
      fs.writeFileSync(coverFilePath, coverBuffer);

      console.log(`☁️ Đang tải lên Supabase Storage...`);
      const storageAudioPath = `${audioId}.mp3`;
      const storageCoverPath = `covers/${coverId}.jpg`;
      await uploadFile(auth.token, storageAudioPath, audioBuffer, 'audio/mpeg');
      await uploadFile(auth.token, storageCoverPath, coverBuffer, 'image/jpeg');

      console.log(`📝 Đang lưu vào database...`);
      await insertTrack(auth.token, {
        title,
        artist: artists,
        storage_path: storageAudioPath,
        cover_path: storageCoverPath,
        uploader_id: auth.user.id,
        file_size: audioBuffer.length,
        is_published: true
      });

      existingSet.add(norm);
      successCount++;
      console.log(`🎉 [THÀNH CÔNG] Đã đăng bài "${title}" lên Pink Tune!`);
    } catch (err) {
      console.error(`❌ LỖI bài "${title}":`, err.message);
      errorCount++;
    } finally {
      try {
        if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
        if (fs.existsSync(coverFilePath)) fs.unlinkSync(coverFilePath);
      } catch {}
    }
  }

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log(`\n==================================================`);
  console.log(`HOÀN TẤT TỰ ĐỘNG!`);
  console.log(`- Đã tải lên mới: ${successCount}`);
  console.log(`- Đã có sẵn (bỏ qua): ${skipCount}`);
  console.log(`- Lỗi: ${errorCount}`);
  console.log(`==================================================`);
}

main().catch(err => {
  console.error('Lỗi nghiêm trọng:', err);
});
