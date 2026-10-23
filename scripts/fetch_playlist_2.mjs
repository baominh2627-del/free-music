import fs from 'node:fs';

const playlistId = '6EMgCox8plLFYiG5cot8sM';

async function fetchPlaylist() {
  console.log('Fetching playlist embed...');
  const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`);
  const html = await res.text();
  
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Could not find __NEXT_DATA__ in embed HTML');
  
  const data = JSON.parse(match[1]);
  const entity = data.props?.pageProps?.state?.data?.entity;
  const trackList = entity?.trackList || [];
  
  console.log(`Playlist Title: ${entity?.title || entity?.name}`);
  console.log(`Total tracks in embed: ${trackList.length}`);
  
  fs.writeFileSync('new_playlist_raw.json', JSON.stringify(trackList, null, 2));
}

fetchPlaylist().catch(console.error);
