import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SUPABASE_URL = 'https://bwngunlfuocytgmqnvxa.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ME4uw-ONInKAh0XfJBzI_A_vKBRk2OF';
const CLOUD_BUCKET = 'pink-tune-music';
const PYTHON_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
const FFMPEG_PATH = path.resolve('node_modules/ffmpeg-static/ffmpeg.exe');

const PLAYLIST_FILE = path.resolve('danh_sach_74_bai_spotify.json');
const PROGRESS_FILE = path.resolve('upload_progress.json');

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
  console.log('=== BẮT ĐẦU TỰ ĐỘNG TẢI VÀ ĐẨY NHẠC LÊN PINK TUNE ===\n');

  if (!fs.existsSync(PLAYLIST_FILE)) {
    throw new Error('Không tìm thấy file playlist: ' + PLAYLIST_FILE);
  }
  const playlist = JSON.parse(fs.readFileSync(PLAYLIST_FILE, 'utf8'));

  let auth = await login();
  console.log(`✅ Đã đăng nhập quản trị thành công (User ID: ${auth.user.id})`);

  const existing = await getExistingTracks();
  const existingSet = new Set(existing.map(t => normalize(t.title)));
  console.log(`📊 Hiện tại thư viện đã có ${existing.length} bài hát.`);

  const tempDir = path.resolve('temp_batch_upload');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < playlist.length; i++) {
    const item = playlist[i];
    const num = item.number;
    const title = item.title;
    const artists = item.artists;
    const ytUrl = item.youtubeUrl;
    const coverUrl = item.coverUrl;

    console.log(`\n--------------------------------------------------`);
    console.log(`[${num}/${playlist.length}] Đang xử lý: "${title}" — ${artists}`);

    // Check if already in Supabase
    if (existingSet.has(normalize(title))) {
      console.log(`⏩ ĐÃ CÓ TRONG THƯ VIỆN, BỎ QUA.`);
      skipCount++;
      continue;
    }

    // Refresh token if needed
    if (Date.now() > auth.expiresAt) {
      console.log('🔄 Đang làm mới phiên đăng nhập...');
      auth = await login();
    }

    const audioId = crypto.randomUUID();
    const coverId = crypto.randomUUID();
    const audioFilePath = path.join(tempDir, `${audioId}.mp3`);
    const coverFilePath = path.join(tempDir, `${coverId}.jpg`);

    try {
      console.log(`⏳ Đang tải âm thanh từ YouTube (${ytUrl})...`);
      const ytCmd = `"${PYTHON_PATH}" -m yt_dlp --ffmpeg-location "${FFMPEG_PATH}" -x --audio-format mp3 --audio-quality 192k --no-playlist -o "${path.join(tempDir, `${audioId}.%(ext)s`)}" "${ytUrl}"`;
      execSync(ytCmd, { stdio: 'pipe' });

      if (!fs.existsSync(audioFilePath)) {
        throw new Error('File âm thanh không được tạo.');
      }
      const audioBuffer = fs.readFileSync(audioFilePath);
      const audioSizeMB = (audioBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`  Audio: ${audioSizeMB} MB`);

      console.log(`⏳ Đang tải ảnh bìa...`);
      const coverRes = await fetch(coverUrl);
      const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
      fs.writeFileSync(coverFilePath, coverBuffer);
      console.log(`  Cover: ${(coverBuffer.length / 1024).toFixed(2)} KB`);

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

      existingSet.add(normalize(title));
      successCount++;
      console.log(`🎉 [THÀNH CÔNG] Đã đăng bài "${title}" lên Pink Tune!`);
    } catch (err) {
      console.error(`❌ LỖI bài "${title}":`, err.message);
      errorCount++;
    } finally {
      // Clean up temp files for this track
      try {
        if (fs.existsSync(audioFilePath)) fs.unlinkSync(audioFilePath);
        if (fs.existsSync(coverFilePath)) fs.unlinkSync(coverFilePath);
      } catch {}
    }
  }

  // Clean temp dir
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log(`\n==================================================`);
  console.log(`HOÀN TẤT BATCH UPLOAD!`);
  console.log(`- Thành công: ${successCount}`);
  console.log(`- Bỏ qua (đã có): ${skipCount}`);
  console.log(`- Lỗi: ${errorCount}`);
  console.log(`==================================================`);
}

main().catch(err => {
  console.error('Lỗi nghiêm trọng:', err);
});
