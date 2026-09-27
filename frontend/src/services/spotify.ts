import { getAccessToken } from './auth'

export interface MediaItem {
  id: string
  title: string
  subtitle: string
  year?: string
  coverUrl: string
  uri: string
  type: 'album' | 'playlist'
  tracksCount?: number
  genres?: string[]
}

export interface TrackItem {
  id: string
  name: string
  trackNumber: number
  durationMs: number
  uri: string
  artists: string
  explicit?: boolean
}

export interface MediaItemDetails {
  id: string
  title: string
  subtitle: string
  year?: string
  coverUrl: string
  uri: string
  type: 'album' | 'playlist'
  tracksCount: number
  totalDurationMs: number
  tracks: TrackItem[]
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term'

export interface TopTrackItem {
  id: string
  name: string
  artists: string
  albumName: string
  albumId: string
  coverUrl: string
  durationMs: number
  uri: string
  popularity: number
  previewUrl?: string | null
  explicit?: boolean
  playCount: number
}

export interface TopArtistItem {
  id: string
  name: string
  genres: string[]
  images: string[]
  imageUrl: string
  popularity: number
  followers?: number
  uri: string
  playCount: number
}

export interface TopAlbumItem {
  id: string
  name: string
  artist: string
  coverUrl: string
  uri: string
  year?: string
  totalTracks?: number
  tracksCountInTop?: number
  playCount: number
}

export interface RecentlyPlayedItem {
  id: string
  trackName: string
  artists: string
  albumName: string
  albumId?: string
  coverUrl: string
  durationMs: number
  uri: string
  playedAt: string
}

export interface PlayResult {
  success: boolean
  error?: string
  noActiveDevice?: boolean
  premiumRequired?: boolean
  insufficientScope?: boolean
}

function getHeaders() {
  const token = getAccessToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}

function okStatus(status: number): boolean {
  return status >= 200 && status < 300
}

export async function getPlaybackState() {
  const token = getAccessToken()
  if (!token) return null

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player', { headers: getHeaders() })
    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      window.location.href = '/'
      return null
    }
    if (res.status === 204 || res.status > 400) return null
    return res.json()
  } catch (err) {
    console.error('getPlaybackState error:', err)
    return null
  }
}

async function executePlayback(bodyPayload?: object): Promise<PlayResult> {
  const token = getAccessToken()
  if (!token) return { success: false, error: 'Not authenticated' }

  try {
    const body = bodyPayload ? JSON.stringify(bodyPayload) : undefined
    let res = await fetch('https://api.spotify.com/v1/me/player/play', {
      method: 'PUT',
      headers: getHeaders(),
      body
    })

    if (res.status === 204 || res.status === 200) return { success: true }

    if (res.status === 404) {
      const devices = await getAvailableDevices()
      if (devices.length > 0) {
        res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${devices[0].id}`, {
          method: 'PUT',
          headers: getHeaders(),
          body
        })
        if (res.status === 204 || res.status === 200) return { success: true }
      }
      return {
        success: false,
        noActiveDevice: true,
        error: 'No active Spotify player found. Please open Spotify on your device.'
      }
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}))
      if (data?.error?.reason === 'PREMIUM_REQUIRED') {
        return { success: false, premiumRequired: true, error: 'Spotify Premium is required to control playback.' }
      }
      return { success: false, error: data?.error?.message || 'Access forbidden.' }
    }

    const data = await res.json().catch(() => ({}))
    return { success: false, error: data?.error?.message || `Playback failed (code ${res.status})` }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error starting playback' }
  }
}

export async function play(contextUri?: string, offset?: { position?: number; uri?: string }): Promise<PlayResult> {
  return executePlayback(contextUri ? { context_uri: contextUri, ...(offset ? { offset } : {}) } : undefined)
}

export async function playContext(contextUri: string, offset?: { position?: number; uri?: string }): Promise<PlayResult> {
  return play(contextUri, offset)
}

export async function playTrack(trackUri: string): Promise<PlayResult> {
  return executePlayback({ uris: [trackUri] })
}

export async function pause() {
  await fetch('https://api.spotify.com/v1/me/player/pause', { method: 'PUT', headers: getHeaders() })
}

export async function seek(positionMs: number) {
  await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${Math.round(positionMs)}`, {
    method: 'PUT',
    headers: getHeaders()
  })
}

export async function nextTrack() {
  await fetch('https://api.spotify.com/v1/me/player/next', { method: 'POST', headers: getHeaders() })
}

export async function previousTrack() {
  await fetch('https://api.spotify.com/v1/me/player/previous', { method: 'POST', headers: getHeaders() })
}

export async function getAvailableDevices(): Promise<any[]> {
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', { headers: getHeaders() })
    if (!res.ok) return []
    const data = await res.json()
    return data.devices || []
  } catch {
    return []
  }
}

export async function getUserAlbums(limit = 50, offset = 0): Promise<{ items: MediaItem[]; total: number; error?: string; insufficientScope?: boolean }> {
  const token = getAccessToken()
  if (!token) return { items: [], total: 0, error: 'Not authenticated' }

  try {
    const res = await fetch(`https://api.spotify.com/v1/me/albums?limit=${limit}&offset=${offset}`, { headers: getHeaders() })
    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      return { items: [], total: 0, error: 'Session expired' }
    }
    if (res.status === 403) {
      return { items: [], total: 0, insufficientScope: true, error: 'Permissions needed to access albums.' }
    }
    if (!res.ok) return { items: [], total: 0, error: `Failed to load albums (${res.status})` }

    const data = await res.json()
    const items: MediaItem[] = (data.items || []).map((entry: any) => {
      const alb = entry.album
      return {
        id: alb.id,
        title: alb.name,
        subtitle: alb.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        year: alb.release_date ? alb.release_date.substring(0, 4) : '',
        coverUrl: alb.images?.[0]?.url || '/mirage.webp',
        uri: alb.uri,
        type: 'album' as const,
        tracksCount: alb.total_tracks
      }
    })
    return { items, total: data.total ?? items.length }
  } catch (err: any) {
    return { items: [], total: 0, error: err?.message || 'Error fetching albums' }
  }
}

export async function getUserPlaylists(limit = 50, offset = 0): Promise<{ items: MediaItem[]; total: number; error?: string; insufficientScope?: boolean }> {
  const token = getAccessToken()
  if (!token) return { items: [], total: 0, error: 'Not authenticated' }

  try {
    const res = await fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, { headers: getHeaders() })
    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      return { items: [], total: 0, error: 'Session expired' }
    }
    if (res.status === 403) {
      return { items: [], total: 0, insufficientScope: true, error: 'Permissions needed to access playlists.' }
    }
    if (!okStatus(res.status)) return { items: [], total: 0, error: `Failed to load playlists (${res.status})` }

    const data = await res.json()
    const items: MediaItem[] = (data.items || []).filter(Boolean).map((pl: any) => ({
      id: pl.id,
      title: pl.name,
      subtitle: `By ${pl.owner?.display_name || 'Spotify'}`,
      coverUrl: pl.images?.[0]?.url || '/mirage.webp',
      uri: pl.uri,
      type: 'playlist' as const,
      tracksCount: pl.tracks?.total
    }))
    return { items, total: data.total ?? items.length }
  } catch (err: any) {
    return { items: [], total: 0, error: err?.message || 'Error fetching playlists' }
  }
}

function getDemoTracks(title: string, artist: string, count = 10): TrackItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `demo-track-${i + 1}`,
    name: `${title} - Part ${i + 1}`,
    trackNumber: i + 1,
    durationMs: 210000 + (i * 13000) % 90000,
    uri: `spotify:track:demo${i + 1}`,
    artists: artist
  }))
}

export async function getAlbumDetails(albumId: string, fallbackItem?: MediaItem): Promise<MediaItemDetails | null> {
  const token = getAccessToken()
  const cleanId = albumId.replace(/^spotify:album:/, '')

  if (cleanId.startsWith('demo-') || !token) {
    const demo = DEMO_ALBUMS.find(a => a.id === cleanId) ?? fallbackItem ?? DEMO_ALBUMS[0]!
    const tracks = getDemoTracks(demo.title, demo.subtitle, demo.tracksCount || 10)
    return {
      id: cleanId,
      title: demo.title,
      subtitle: demo.subtitle,
      year: demo.year || '',
      coverUrl: demo.coverUrl,
      uri: demo.uri,
      type: 'album',
      tracksCount: tracks.length,
      totalDurationMs: tracks.reduce((acc, t) => acc + t.durationMs, 0),
      tracks
    }
  }

  try {
    const res = await fetch(`https://api.spotify.com/v1/albums/${cleanId}`, { headers: getHeaders() })
    if (!res.ok) return fallbackItem ? { ...fallbackItem, tracksCount: fallbackItem.tracksCount || 0, totalDurationMs: 0, tracks: [] } : null

    const data = await res.json()
    const tracks: TrackItem[] = (data.tracks?.items || []).map((t: any, idx: number) => ({
      id: t.id || `track-${idx}`,
      name: t.name,
      trackNumber: t.track_number ?? (idx + 1),
      durationMs: t.duration_ms || 0,
      uri: t.uri,
      artists: t.artists?.map((a: any) => a.name).join(', ') || '',
      explicit: Boolean(t.explicit)
    }))
    return {
      id: data.id || cleanId,
      title: data.name,
      subtitle: data.artists?.map((a: any) => a.name).join(', ') || fallbackItem?.subtitle || '',
      year: data.release_date ? data.release_date.substring(0, 4) : (fallbackItem?.year || ''),
      coverUrl: data.images?.[0]?.url || fallbackItem?.coverUrl || '/mirage.webp',
      uri: data.uri || `spotify:album:${cleanId}`,
      type: 'album',
      tracksCount: data.total_tracks ?? tracks.length,
      totalDurationMs: tracks.reduce((acc, t) => acc + t.durationMs, 0),
      tracks
    }
  } catch {
    return fallbackItem ? { ...fallbackItem, tracksCount: fallbackItem.tracksCount || 0, totalDurationMs: 0, tracks: [] } : null
  }
}

export async function getPlaylistDetails(playlistId: string, fallbackItem?: MediaItem): Promise<MediaItemDetails | null> {
  const token = getAccessToken()
  const cleanId = playlistId.replace(/^spotify:playlist:/, '')

  if (cleanId.startsWith('demo-') || !token) {
    const demo = DEMO_PLAYLISTS.find(p => p.id === cleanId) ?? fallbackItem ?? DEMO_PLAYLISTS[0]!
    const tracks = getDemoTracks(demo.title, demo.subtitle, demo.tracksCount || 8)
    return {
      id: cleanId,
      title: demo.title,
      subtitle: demo.subtitle,
      coverUrl: demo.coverUrl,
      uri: demo.uri,
      type: 'playlist',
      tracksCount: tracks.length,
      totalDurationMs: tracks.reduce((acc, t) => acc + t.durationMs, 0),
      tracks
    }
  }

  try {
    const res = await fetch(`https://api.spotify.com/v1/playlists/${cleanId}`, { headers: getHeaders() })
    if (res.ok) {
      const data = await res.json()
      const tracks: TrackItem[] = (data.tracks?.items || [])
        .filter((item: any) => item && item.track)
        .map((item: any, idx: number) => ({
          id: item.track.id || `track-${idx}`,
          name: item.track.name || 'Untitled Track',
          trackNumber: idx + 1,
          durationMs: item.track.duration_ms || 0,
          uri: item.track.uri,
          artists: item.track.artists?.map((a: any) => a.name).join(', ') || '',
          explicit: Boolean(item.track.explicit)
        }))
      return {
        id: data.id || cleanId,
        title: data.name || fallbackItem?.title || 'Playlist',
        subtitle: data.owner?.display_name ? `By ${data.owner.display_name}` : (fallbackItem?.subtitle || 'Spotify'),
        coverUrl: data.images?.[0]?.url || fallbackItem?.coverUrl || '/mirage.webp',
        uri: data.uri || fallbackItem?.uri || `spotify:playlist:${cleanId}`,
        type: 'playlist',
        tracksCount: data.tracks?.total ?? tracks.length,
        totalDurationMs: tracks.reduce((acc, t) => acc + t.durationMs, 0),
        tracks
      }
    }
    return fallbackItem ? { ...fallbackItem, tracksCount: fallbackItem.tracksCount || 0, totalDurationMs: 0, tracks: [] } : null
  } catch {
    return fallbackItem ? { ...fallbackItem, tracksCount: fallbackItem.tracksCount || 0, totalDurationMs: 0, tracks: [] } : null
  }
}

// Play count derivations for time ranges
function calculateTrackPlays(index: number, timeRange: TimeRange, popularity = 50): number {
  const popBonus = Math.round(popularity / 10)
  if (timeRange === 'short_term') {
    return Math.max(5, Math.round(52 * Math.pow(0.86, index)) + popBonus)
  }
  if (timeRange === 'medium_term') {
    return Math.max(18, Math.round(185 * Math.pow(0.88, index)) + popBonus * 3)
  }
  return Math.max(45, Math.round(420 * Math.pow(0.89, index)) + popBonus * 6)
}

function calculateArtistPlays(index: number, timeRange: TimeRange, trackPlaysSum: number): number {
  let basePlays = 0
  if (timeRange === 'short_term') basePlays = Math.max(15, Math.round(85 * Math.pow(0.84, index)))
  else if (timeRange === 'medium_term') basePlays = Math.max(40, Math.round(290 * Math.pow(0.85, index)))
  else basePlays = Math.max(95, Math.round(650 * Math.pow(0.86, index)))
  return Math.max(basePlays, trackPlaysSum)
}

export async function getTopTracks(
  timeRange: TimeRange = 'short_term',
  limit = 10
): Promise<{ items: TopTrackItem[]; error?: string; insufficientScope?: boolean }> {
  const token = getAccessToken()
  if (!token) return { items: [] }

  try {
    const res = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=${limit}`, {
      headers: getHeaders()
    })
    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      return { items: [], error: 'Session expired' }
    }
    if (res.status === 403) {
      return { items: [], insufficientScope: true, error: 'Permission needed to access top tracks.' }
    }
    if (!okStatus(res.status)) return { items: [], error: `Failed to load top tracks (${res.status})` }

    const data = await res.json()
    const items: TopTrackItem[] = (data.items || []).slice(0, limit).map((t: any, index: number) => ({
      id: t.id,
      name: t.name,
      artists: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
      albumName: t.album?.name || 'Unknown Album',
      albumId: t.album?.id || '',
      coverUrl: t.album?.images?.[0]?.url || '/mirage.webp',
      durationMs: t.duration_ms || 0,
      uri: t.uri,
      popularity: t.popularity ?? 50,
      previewUrl: t.preview_url,
      explicit: Boolean(t.explicit),
      playCount: calculateTrackPlays(index, timeRange, t.popularity ?? 50)
    }))
    return { items }
  } catch (err: any) {
    return { items: [], error: err?.message || 'Error fetching top tracks' }
  }
}

export async function getTopArtists(
  timeRange: TimeRange = 'short_term',
  limit = 5
): Promise<{ items: TopArtistItem[]; error?: string; insufficientScope?: boolean }> {
  const token = getAccessToken()
  if (!token) return { items: [] }

  try {
    const [artistsRes, tracksRes] = await Promise.all([
      fetch(`https://api.spotify.com/v1/me/top/artists?time_range=${timeRange}&limit=${limit}`, {
        headers: getHeaders()
      }),
      getTopTracks(timeRange, 50)
    ])

    if (artistsRes.status === 401) {
      localStorage.removeItem('spotify_token')
      return { items: [], error: 'Session expired' }
    }
    if (artistsRes.status === 403) {
      return { items: [], insufficientScope: true, error: 'Permission needed to access top artists.' }
    }
    if (!okStatus(artistsRes.status)) return { items: [], error: `Failed to load top artists (${artistsRes.status})` }

    const data = await artistsRes.json()
    const topTracksItems = tracksRes.items || []

    const items: TopArtistItem[] = (data.items || []).slice(0, limit).map((a: any, index: number) => {
      const artistTracks = topTracksItems.filter(t => t.artists.toLowerCase().includes(a.name.toLowerCase()))
      const trackPlaysSum = artistTracks.reduce((sum, t) => sum + t.playCount, 0)
      return {
        id: a.id,
        name: a.name,
        genres: a.genres || [],
        images: a.images?.map((img: any) => img.url) || [],
        imageUrl: a.images?.[0]?.url || '/mirage.webp',
        popularity: a.popularity ?? 50,
        followers: a.followers?.total,
        uri: a.uri,
        playCount: calculateArtistPlays(index, timeRange, trackPlaysSum)
      }
    })
    return { items }
  } catch (err: any) {
    return { items: [], error: err?.message || 'Error fetching top artists' }
  }
}

export async function getTopAlbums(
  timeRange: TimeRange = 'short_term',
  limit = 5
): Promise<{ items: TopAlbumItem[]; error?: string; insufficientScope?: boolean }> {
  const token = getAccessToken()
  if (!token) return { items: [] }

  try {
    const tracksRes = await getTopTracks(timeRange, 50)
    if (tracksRes.insufficientScope) return { items: [], insufficientScope: true, error: tracksRes.error }
    if (!tracksRes.items || tracksRes.items.length === 0) return { items: [] }

    const albumMap = new Map<string, { album: TopAlbumItem; score: number; count: number; totalPlays: number }>()

    tracksRes.items.forEach((track, index) => {
      if (!track.albumId) return
      const weight = Math.max(1, 50 - index)
      const existing = albumMap.get(track.albumId)
      if (existing) {
        existing.score += weight
        existing.count += 1
        existing.totalPlays += track.playCount
      } else {
        albumMap.set(track.albumId, {
          score: weight,
          count: 1,
          totalPlays: track.playCount,
          album: {
            id: track.albumId,
            name: track.albumName,
            artist: track.artists,
            coverUrl: track.coverUrl,
            uri: `spotify:album:${track.albumId}`,
            tracksCountInTop: 1,
            playCount: track.playCount
          }
        })
      }
    })

    const sortedAlbums = Array.from(albumMap.values())
      .sort((a, b) => b.totalPlays - a.totalPlays || b.score - a.score)
      .slice(0, limit)
      .map(entry => ({
        ...entry.album,
        tracksCountInTop: entry.count,
        playCount: entry.totalPlays
      }))

    return { items: sortedAlbums }
  } catch (err: any) {
    return { items: [], error: err?.message || 'Error fetching top albums' }
  }
}

export async function getRecentlyPlayed(
  limit = 10
): Promise<{ items: RecentlyPlayedItem[]; error?: string; insufficientScope?: boolean }> {
  const token = getAccessToken()
  if (!token) return { items: [] }

  try {
    const res = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
      headers: getHeaders()
    })
    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      return { items: [], error: 'Session expired' }
    }
    if (res.status === 403) {
      return { items: [], insufficientScope: true, error: 'Permission needed to access listening history.' }
    }
    if (!okStatus(res.status)) return { items: [], error: `Failed to load recently played (${res.status})` }

    const data = await res.json()
    const items: RecentlyPlayedItem[] = (data.items || []).slice(0, limit).map((entry: any, idx: number) => {
      const t = entry.track
      return {
        id: `${t.id}-${entry.played_at || idx}`,
        trackName: t.name,
        artists: t.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist',
        albumName: t.album?.name || 'Unknown Album',
        albumId: t.album?.id,
        coverUrl: t.album?.images?.[0]?.url || '/mirage.webp',
        durationMs: t.duration_ms || 0,
        uri: t.uri,
        playedAt: entry.played_at || new Date().toISOString()
      }
    })
    return { items }
  } catch (err: any) {
    return { items: [], error: err?.message || 'Error fetching recently played' }
  }
}

// Compact preview collection for turntable library
export const DEMO_ALBUMS: MediaItem[] = [
  { id: 'demo-1', title: 'Random Access Memories', subtitle: 'Daft Punk', year: '2013', coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg', uri: 'spotify:album:4m2880jivSbbyEGAKfITCa', type: 'album', tracksCount: 13 },
  { id: 'demo-2', title: 'The Dark Side of the Moon', subtitle: 'Pink Floyd', year: '1973', coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/49/86/18/49861852-877b-0992-fa27-58b25fa032b5/196589805232.jpg/600x600bb.jpg', uri: 'spotify:album:4LH4d3cOWNNXdsqFd4G7gv', type: 'album', tracksCount: 10 },
  { id: 'demo-3', title: 'Currents', subtitle: 'Tame Impala', year: '2015', coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/600x600bb.jpg', uri: 'spotify:album:79dL7FLiJFOO0EoehUHQBv', type: 'album', tracksCount: 13 },
  { id: 'demo-4', title: 'Rumours', subtitle: 'Fleetwood Mac', year: '1977', coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg', uri: 'spotify:album:1bt6q2S3hk52zNVq0MYYoq', type: 'album', tracksCount: 11 },
  { id: 'demo-5', title: 'Abbey Road', subtitle: 'The Beatles', year: '1969', coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg', uri: 'spotify:album:0ETFjA39vXvRwEhG97Y6TN', type: 'album', tracksCount: 17 }
]

export const DEMO_PLAYLISTS: MediaItem[] = [
  { id: 'demo-pl-1', title: 'Late Night Vinyl Sessions', subtitle: 'By Spinback Curators', coverUrl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=600&auto=format&fit=crop&q=80', uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M', type: 'playlist', tracksCount: 10 },
  { id: 'demo-pl-2', title: 'Analog Warmth & Chill', subtitle: 'By Audiophile Vault', coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80', uri: 'spotify:playlist:37i9dQZF1DX4WYpdgoIcn6', type: 'playlist', tracksCount: 8 },
  { id: 'demo-pl-3', title: 'Japanese City Pop & Funk', subtitle: 'By Tokyo Groove', coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80', uri: 'spotify:playlist:37i9dQZF1DXdbXrPNafg9d', type: 'playlist', tracksCount: 8 }
]