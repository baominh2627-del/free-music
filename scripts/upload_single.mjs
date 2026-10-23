import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SUPABASE_URL = 'https://bwngunlfuocytgmqnvxa.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_ME4uw-ONInKAh0XfJBzI_A_vKBRk2OF';
const CLOUD_BUCKET = 'pink-tune-music';
const PYTHON_PATH = 'C:\\Users\\DELL\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';

async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'baominh2627@gmail.com', password: 'Cun01626345930@' })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Login failed: ' + JSON.stringify(data));
  return { token: data.access_token, user: data.user };
}

async function uploadFileWithRetry(token, bucketPath, fileBuffer, contentType, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
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
      if (res.ok) return;
      const err = await res.text();
      console.warn(`Attempt ${attempt} failed (${res.status}): ${err.slice(0, 100)}...`);
      if (attempt < maxRetries) await new Promise(r => setTimeout(r, 2000));
      else throw new Error(`Upload failed (${res.status}): ${err}`);
    } catch (e) {
      if (attempt < maxRetries) {
        console.warn(`Attempt ${attempt} error: ${e.message}. Retrying in 2s...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        throw e;
      }
    }
  }
}

async function main() {
  const auth = await login();
  console.log('✅ Logged in as admin');

  const title = "Don’t";
  const artists = "Loco, HWASA";
  const coverUrl = "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000b273eb743c2304497543c3b8bdd0";

  const tempDir = path.resolve('temp_single');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const audioId = crypto.randomUUID();
  const coverId = crypto.randomUUID();
  const outTemplate = path.join(tempDir, `${audioId}.%(ext)s`);

  console.log(`Downloading audio for "${title}" - ${artists}...`);
  const ytCmd = `"${PYTHON_PATH}" -m yt_dlp -f "ba[ext=m4a]/ba/b" --no-playlist -o "${outTemplate}" "ytsearch1:Don't Loco HWASA"`;
  execSync(ytCmd, { stdio: 'inherit' });

  const files = fs.readdirSync(tempDir).filter(f => f.startsWith(audioId));
  if (!files.length) throw new Error('Audio file not found');
  const downloadedFile = path.join(tempDir, files[0]);
  const ext = path.extname(files[0]).slice(1) || 'm4a';
  const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';
  const audioBuffer = fs.readFileSync(downloadedFile);

  console.log(`Downloading cover...`);
  const coverRes = await fetch(coverUrl);
  const coverBuffer = Buffer.from(await coverRes.arrayBuffer());

  console.log(`Uploading storage...`);
  const storageAudioPath = `${audioId}.${ext}`;
  const storageCoverPath = `covers/${coverId}.jpg`;
  await uploadFileWithRetry(auth.token, storageAudioPath, audioBuffer, contentType);
  await uploadFileWithRetry(auth.token, storageCoverPath, coverBuffer, 'image/jpeg');

  console.log(`Inserting track into pink_tune_tracks...`);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/pink_tune_tracks`, {
    method: 'POST',
    headers: {
      'apikey': PUBLISHABLE_KEY,
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      title,
      artist: artists,
      storage_path: storageAudioPath,
      cover_path: storageCoverPath,
      uploader_id: auth.user.id,
      file_size: audioBuffer.length,
      is_published: true
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Insert track failed: ${err}`);
  }
  const inserted = await res.json();
  console.log('🎉 THÀNH CÔNG! Đã đăng bài "Don’t":', inserted);
}

main().catch(console.error);
