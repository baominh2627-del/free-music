import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SUPABASE_URL = 'https://bwngunlfuocytgmqnvxa.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ME4uw-ONInKAh0XfJBzI_A_vKBRk2OF';
const CLOUD_BUCKET = 'pink-tune-music';
const PYTHON_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';

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

async function main() {
  const remaining = JSON.parse(fs.readFileSync('korean_remaining.json', 'utf8'));
  console.log(`=== BẮT ĐẦU TẢI ${remaining.length} BÀI NHẠC HÀN CÒN LẠI ===\n`);

  let auth = await login();
  console.log(`✅ Đã đăng nhập quản trị (User ID: ${auth.user.id})`);

  const tempDir = path.resolve('temp_korean_fast');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < remaining.length; i++) {
    const item = remaining[i];
    const title = item.title;
    const artists = item.artists;
    const coverUrl = item.coverUrl;

    console.log(`\n--------------------------------------------------`);
    console.log(`[${i + 1}/${remaining.length}] "${title}" — ${artists}`);

    if (Date.now() > auth.expiresAt) {
      console.log('🔄 Làm mới token...');
      auth = await login();
    }

    const audioId = crypto.randomUUID();
    const coverId = crypto.randomUUID();
    const outTemplate = path.join(tempDir, `${audioId}.%(ext)s`);
    const coverFilePath = path.join(tempDir, `${coverId}.jpg`);

    try {
      const cleanTitle = title.replace(/\(feat\.[^)]*\)/gi, '').replace(/\(OST[^)]*\)/gi, '').trim();
      const firstArtist = artists.split(',')[0].replace(/"/g, '').trim();
      const searchQuery = `ytsearch1:${cleanTitle} ${firstArtist}`;

      console.log(`⏳ Tải audio native: ${searchQuery}...`);
      const ytCmd = `"${PYTHON_PATH}" -m yt_dlp -f "ba[ext=m4a]/ba/b" --no-playlist -o "${outTemplate}" "${searchQuery}"`;
      execSync(ytCmd, { stdio: 'ignore' });

      // Find downloaded audio file in tempDir
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith(audioId));
      if (!files.length) throw new Error('Không tìm thấy file audio vừa tải');
      const downloadedFile = path.join(tempDir, files[0]);
      const ext = path.extname(files[0]).slice(1) || 'm4a';
      const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';

      const audioBuffer = fs.readFileSync(downloadedFile);
      console.log(`  Audio (${ext}): ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      console.log(`⏳ Tải cover...`);
      const coverRes = await fetch(coverUrl);
      const coverBuffer = Buffer.from(await coverRes.arrayBuffer());
      fs.writeFileSync(coverFilePath, coverBuffer);

      console.log(`☁️ Upload Supabase...`);
      const storageAudioPath = `${audioId}.${ext}`;
      const storageCoverPath = `covers/${coverId}.jpg`;
      await uploadFile(auth.token, storageAudioPath, audioBuffer, contentType);
      await uploadFile(auth.token, storageCoverPath, coverBuffer, 'image/jpeg');

      console.log(`📝 Lưu database...`);
      await insertTrack(auth.token, {
        title,
        artist: artists,
        storage_path: storageAudioPath,
        cover_path: storageCoverPath,
        uploader_id: auth.user.id,
        file_size: audioBuffer.length,
        is_published: true
      });

      successCount++;
      console.log(`🎉 [THÀNH CÔNG] Đã đăng bài "${title}"!`);

      // Clean up files for this track
      try {
        fs.unlinkSync(downloadedFile);
        if (fs.existsSync(coverFilePath)) fs.unlinkSync(coverFilePath);
      } catch {}

      await sleep(1000);
    } catch (err) {
      console.error(`❌ LỖI bài "${title}":`, err.message);
      errorCount++;
    }
  }

  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  console.log(`\n==================================================`);
  console.log(`HOÀN TẤT! Thành công: ${successCount}, Lỗi: ${errorCount}`);
  console.log(`==================================================`);
}

main().catch(console.error);
