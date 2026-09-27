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

export async function getPlaybackState() {
  const token = getAccessToken()
  if (!token) return null

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player', { 
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    })
    
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

export async function play(
  contextUri?: string, 
  offset?: { position?: number; uri?: string }
): Promise<PlayResult> {
  const token = getAccessToken()
  if (!token) return { success: false, error: 'Not authenticated' }

  try {
    const body = contextUri 
      ? JSON.stringify({ 
          context_uri: contextUri, 
          ...(offset ? { offset } : {}) 
        }) 
      : undefined

    let res = await fetch('https://api.spotify.com/v1/me/player/play', { 
      method: 'PUT', 
      headers: getHeaders(),
      body
    })

    if (res.status === 204 || res.status === 200) {
      return { success: true }
    }

    if (res.status === 404) {
      // Check if devices exist
      const devices = await getAvailableDevices()
      if (devices.length > 0) {
        const targetId = devices[0].id
        res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${targetId}`, {
          method: 'PUT',
          headers: getHeaders(),
          body
        })
        if (res.status === 204 || res.status === 200) {
          return { success: true }
        }
      }
      return {
        success: false,
        noActiveDevice: true,
        error: 'No active Spotify player found. Please open Spotify on your device and press Play.'
      }
    }

    if (res.status === 403) {
      const data = await res.json().catch(() => ({}))
      const reason = data?.error?.reason
      if (reason === 'PREMIUM_REQUIRED') {
        return {
          success: false,
          premiumRequired: true,
          error: 'Spotify Premium is required to control playback from external apps.'
        }
      }
      return {
        success: false,
        error: data?.error?.message || 'Access forbidden. Please re-authenticate.'
      }
    }

    const data = await res.json().catch(() => ({}))
    return {
      success: false,
      error: data?.error?.message || `Playback failed (code ${res.status})`
    }
  } catch (e: any) {
    return { success: false, error: e?.message || 'Network error starting playback' }
  }
}

export async function playContext(
  contextUri: string, 
  offset?: { position?: number; uri?: string }
): Promise<PlayResult> {
  return play(contextUri, offset)
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
  await fetch('https://api.spotify.com/v1/me/player/next', { 
    method: 'POST', 
    headers: getHeaders() 
  })
}

export async function previousTrack() {
  await fetch('https://api.spotify.com/v1/me/player/previous', { 
    method: 'POST', 
    headers: getHeaders() 
  })
}

export async function getAvailableDevices(): Promise<any[]> {
  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/devices', {
      headers: getHeaders()
    })
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
    const res = await fetch(`https://api.spotify.com/v1/me/albums?limit=${limit}&offset=${offset}`, {
      headers: getHeaders()
    })

    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      return { items: [], total: 0, error: 'Session expired' }
    }

    if (res.status === 403) {
      return { items: [], total: 0, insufficientScope: true, error: 'Permissions needed to access your saved albums. Please reconnect Spotify.' }
    }

    if (!res.ok) {
      return { items: [], total: 0, error: `Failed to load albums (status ${res.status})` }
    }

    const data = await res.json()
    const items: MediaItem[] = (data.items || []).map((entry: any) => {
      const alb = entry.album
      const cover = alb.images?.[0]?.url || '/mirage.webp'
      const artist = alb.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist'
      const year = alb.release_date ? alb.release_date.substring(0, 4) : ''
      return {
        id: alb.id,
        title: alb.name,
        subtitle: artist,
        year,
        coverUrl: cover,
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
    const res = await fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, {
      headers: getHeaders()
    })

    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      return { items: [], total: 0, error: 'Session expired' }
    }

    if (res.status === 403) {
      return { items: [], total: 0, insufficientScope: true, error: 'Permissions needed to access your playlists. Please reconnect Spotify.' }
    }

    if (!okStatus(res.status)) {
      return { items: [], total: 0, error: `Failed to load playlists (status ${res.status})` }
    }

    const data = await res.json()
    const items: MediaItem[] = (data.items || []).filter(Boolean).map((pl: any) => {
      const cover = pl.images?.[0]?.url || '/mirage.webp'
      const owner = pl.owner?.display_name || 'Spotify'
      return {
        id: pl.id,
        title: pl.name,
        subtitle: `By ${owner}`,
        coverUrl: cover,
        uri: pl.uri,
        type: 'playlist' as const,
        tracksCount: pl.tracks?.total
      }
    })

    return { items, total: data.total ?? items.length }
  } catch (err: any) {
    return { items: [], total: 0, error: err?.message || 'Error fetching playlists' }
  }
}

export async function getAlbumDetails(albumId: string, fallbackItem?: MediaItem): Promise<MediaItemDetails | null> {
  const token = getAccessToken()
  const cleanId = albumId.replace(/^spotify:album:/, '')

  // Handle demo or unauthenticated mode
  if (cleanId.startsWith('demo-') || !token) {
    const demo = DEMO_ALBUMS.find(a => a.id === cleanId) ?? fallbackItem ?? DEMO_ALBUMS[0]!
    const tracks = DEMO_TRACKS_MAP[cleanId] || DEMO_TRACKS_MAP['demo-1'] || []
    const totalDurationMs = tracks.reduce((acc, t) => acc + t.durationMs, 0)
    return {
      id: cleanId,
      title: demo.title,
      subtitle: demo.subtitle,
      year: demo.year || '',
      coverUrl: demo.coverUrl,
      uri: demo.uri,
      type: 'album',
      tracksCount: tracks.length || (demo.tracksCount ?? 0),
      totalDurationMs,
      tracks
    }
  }

  try {
    const res = await fetch(`https://api.spotify.com/v1/albums/${cleanId}`, {
      headers: getHeaders()
    })

    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      window.location.reload()
      return null
    }

    if (!res.ok) {
      if (fallbackItem) {
        return {
          id: cleanId,
          title: fallbackItem.title,
          subtitle: fallbackItem.subtitle,
          year: fallbackItem.year || '',
          coverUrl: fallbackItem.coverUrl,
          uri: fallbackItem.uri,
          type: 'album',
          tracksCount: fallbackItem.tracksCount || 0,
          totalDurationMs: 0,
          tracks: []
        }
      }
      return null
    }

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
    const totalDurationMs = tracks.reduce((acc, t) => acc + t.durationMs, 0)
    return {
      id: data.id || cleanId,
      title: data.name,
      subtitle: data.artists?.map((a: any) => a.name).join(', ') || fallbackItem?.subtitle || '',
      year: data.release_date ? data.release_date.substring(0, 4) : (fallbackItem?.year || ''),
      coverUrl: data.images?.[0]?.url || fallbackItem?.coverUrl || '/mirage.webp',
      uri: data.uri || `spotify:album:${cleanId}`,
      type: 'album',
      tracksCount: data.total_tracks ?? tracks.length,
      totalDurationMs,
      tracks
    }
  } catch (err) {
    console.error('getAlbumDetails error:', err)
    if (fallbackItem) {
      return {
        id: cleanId,
        title: fallbackItem.title,
        subtitle: fallbackItem.subtitle,
        year: fallbackItem.year || '',
        coverUrl: fallbackItem.coverUrl,
        uri: fallbackItem.uri,
        type: 'album',
        tracksCount: fallbackItem.tracksCount || 0,
        totalDurationMs: 0,
        tracks: []
      }
    }
    return null
  }
}

export async function getPlaylistDetails(playlistId: string, fallbackItem?: MediaItem): Promise<MediaItemDetails | null> {
  const token = getAccessToken()
  const cleanId = playlistId.replace(/^spotify:playlist:/, '')

  // Handle demo or unauthenticated mode
  if (cleanId.startsWith('demo-') || !token) {
    const demo = DEMO_PLAYLISTS.find(p => p.id === cleanId) ?? fallbackItem ?? DEMO_PLAYLISTS[0]!
    const tracks = DEMO_TRACKS_MAP[cleanId] || DEMO_TRACKS_MAP['demo-pl-1'] || []
    const totalDurationMs = tracks.reduce((acc, t) => acc + t.durationMs, 0)
    return {
      id: cleanId,
      title: demo.title,
      subtitle: demo.subtitle,
      coverUrl: demo.coverUrl,
      uri: demo.uri,
      type: 'playlist',
      tracksCount: tracks.length || (demo.tracksCount ?? 0),
      totalDurationMs,
      tracks
    }
  }

  try {
    let res = await fetch(`https://api.spotify.com/v1/playlists/${cleanId}`, {
      headers: getHeaders()
    })

    if (res.status === 401) {
      localStorage.removeItem('spotify_token')
      window.location.reload()
      return null
    }

    if (res.ok) {
      const data = await res.json()
      const tracks: TrackItem[] = (data.tracks?.items || [])
        .filter((item: any) => item && item.track)
        .map((item: any, idx: number) => {
          const t = item.track
          const artistNames = t.artists?.map((a: any) => a.name).join(', ') || t.show?.name || ''
          return {
            id: t.id || `track-${idx}`,
            name: t.name || 'Untitled Track',
            trackNumber: idx + 1,
            durationMs: t.duration_ms || 0,
            uri: t.uri,
            artists: artistNames,
            explicit: Boolean(t.explicit)
          }
        })

      const totalDurationMs = tracks.reduce((acc, t) => acc + t.durationMs, 0)
      const cover = data.images?.[0]?.url || fallbackItem?.coverUrl || '/mirage.webp'
      const owner = data.owner?.display_name ? `By ${data.owner.display_name}` : (fallbackItem?.subtitle || 'Spotify')

      return {
        id: data.id || cleanId,
        title: data.name || fallbackItem?.title || 'Playlist',
        subtitle: owner,
        coverUrl: cover,
        uri: data.uri || fallbackItem?.uri || `spotify:playlist:${cleanId}`,
        type: 'playlist',
        tracksCount: data.tracks?.total ?? tracks.length,
        totalDurationMs,
        tracks
      }
    }

    // Secondary try: /playlists/{id}/tracks endpoint
    const tracksRes = await fetch(`https://api.spotify.com/v1/playlists/${cleanId}/tracks?limit=50`, {
      headers: getHeaders()
    })

    if (tracksRes.ok) {
      const tracksData = await tracksRes.json()
      const tracks: TrackItem[] = (tracksData.items || [])
        .filter((item: any) => item && item.track)
        .map((item: any, idx: number) => {
          const t = item.track
          return {
            id: t.id || `track-${idx}`,
            name: t.name || 'Untitled Track',
            trackNumber: idx + 1,
            durationMs: t.duration_ms || 0,
            uri: t.uri,
            artists: t.artists?.map((a: any) => a.name).join(', ') || '',
            explicit: Boolean(t.explicit)
          }
        })

      const totalDurationMs = tracks.reduce((acc, t) => acc + t.durationMs, 0)

      return {
        id: cleanId,
        title: fallbackItem?.title || 'Playlist',
        subtitle: fallbackItem?.subtitle || 'By Spotify',
        coverUrl: fallbackItem?.coverUrl || '/mirage.webp',
        uri: fallbackItem?.uri || `spotify:playlist:${cleanId}`,
        type: 'playlist',
        tracksCount: tracksData.total ?? tracks.length,
        totalDurationMs,
        tracks
      }
    }

    if (fallbackItem) {
      return {
        id: cleanId,
        title: fallbackItem.title,
        subtitle: fallbackItem.subtitle,
        coverUrl: fallbackItem.coverUrl,
        uri: fallbackItem.uri,
        type: 'playlist',
        tracksCount: fallbackItem.tracksCount || 0,
        totalDurationMs: 0,
        tracks: []
      }
    }

    return null
  } catch (err) {
    console.error('getPlaylistDetails error:', err)
    if (fallbackItem) {
      return {
        id: cleanId,
        title: fallbackItem.title,
        subtitle: fallbackItem.subtitle,
        coverUrl: fallbackItem.coverUrl,
        uri: fallbackItem.uri,
        type: 'playlist',
        tracksCount: fallbackItem.tracksCount || 0,
        totalDurationMs: 0,
        tracks: []
      }
    }
    return null
  }
}

function okStatus(status: number): boolean {
  return status >= 200 && status < 300
}

// Fallback demo collection in case user has no saved items or wants a preview
export const DEMO_ALBUMS: MediaItem[] = [
  {
    id: 'demo-1',
    title: 'Random Access Memories',
    subtitle: 'Daft Punk',
    year: '2013',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/e8/43/5f/e8435ffa-b6b9-b171-40ab-4ff3959ab661/886443919266.jpg/600x600bb.jpg',
    uri: 'spotify:album:4m2880jivSbbyEGAKfITCa',
    type: 'album',
    tracksCount: 13
  },
  {
    id: 'demo-2',
    title: 'The Dark Side of the Moon',
    subtitle: 'Pink Floyd',
    year: '1973',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/49/86/18/49861852-877b-0992-fa27-58b25fa032b5/196589805232.jpg/600x600bb.jpg',
    uri: 'spotify:album:4LH4d3cOWNNXdsqFd4G7gv',
    type: 'album',
    tracksCount: 10
  },
  {
    id: 'demo-3',
    title: 'Currents',
    subtitle: 'Tame Impala',
    year: '2015',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/a8/2e/b4/a82eb490-f30a-a321-461a-0383c88fec95/15UMGIM23316.rgb.jpg/600x600bb.jpg',
    uri: 'spotify:album:79dL7FLiJFOO0EoehUHQBv',
    type: 'album',
    tracksCount: 13
  },
  {
    id: 'demo-4',
    title: 'Rumours',
    subtitle: 'Fleetwood Mac',
    year: '1977',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music124/v4/4d/13/ba/4d13bac3-d3d5-7581-2c74-034219eadf2b/081227970949.jpg/600x600bb.jpg',
    uri: 'spotify:album:1bt6q2S3hk52zNVq0MYYoq',
    type: 'album',
    tracksCount: 11
  },
  {
    id: 'demo-5',
    title: 'Abbey Road',
    subtitle: 'The Beatles',
    year: '1969',
    coverUrl: 'https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/48/53/43/485343e3-dd6a-0034-faec-f4b6403f8108/13UMGIM63890.rgb.jpg/600x600bb.jpg',
    uri: 'spotify:album:0ETFjA39vXvRwEhG97Y6TN',
    type: 'album',
    tracksCount: 17
  },
]

export const DEMO_PLAYLISTS: MediaItem[] = [
  {
    id: 'demo-pl-1',
    title: 'Late Night Vinyl Sessions',
    subtitle: 'By Spinback Curators',
    coverUrl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
    type: 'playlist',
    tracksCount: 10
  },
  {
    id: 'demo-pl-2',
    title: 'Analog Warmth & Chill',
    subtitle: 'By Audiophile Vault',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:playlist:37i9dQZF1DX4WYpdgoIcn6',
    type: 'playlist',
    tracksCount: 8
  },
  {
    id: 'demo-pl-3',
    title: 'Japanese City Pop & Funk',
    subtitle: 'By Tokyo Groove',
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:playlist:37i9dQZF1DXdbXrPNafg9d',
    type: 'playlist',
    tracksCount: 8
  }
]

export const DEMO_TRACKS_MAP: Record<string, TrackItem[]> = {
  'demo-1': [
    { id: 'ram-1', name: 'Give Life Back to Music', trackNumber: 1, durationMs: 275000, uri: 'spotify:track:0dEIa2qtwnqp9CCIgrWgAU', artists: 'Daft Punk' },
    { id: 'ram-2', name: 'The Game of Love', trackNumber: 2, durationMs: 322000, uri: 'spotify:track:7ycEuFk0PqA7sQyS9f4N01', artists: 'Daft Punk' },
    { id: 'ram-3', name: 'Giorgio by Moroder', trackNumber: 3, durationMs: 545000, uri: 'spotify:track:0oks4FnzhNp5QPTZtoet7K', artists: 'Daft Punk, Giorgio Moroder' },
    { id: 'ram-4', name: 'Within', trackNumber: 4, durationMs: 228000, uri: 'spotify:track:7wD3Z32a4l9pI1j9vKq1bC', artists: 'Daft Punk, Chilly Gonzales' },
    { id: 'ram-5', name: 'Instant Crush', trackNumber: 5, durationMs: 337000, uri: 'spotify:track:2cGxRwrMyEAp8dEbuZaVv6', artists: 'Daft Punk feat. Julian Casablancas' },
    { id: 'ram-6', name: 'Lose Yourself to Dance', trackNumber: 6, durationMs: 353000, uri: 'spotify:track:5CMjjywI0eZMixPeqNd75R', artists: 'Daft Punk feat. Pharrell Williams' },
    { id: 'ram-7', name: 'Touch', trackNumber: 7, durationMs: 498000, uri: 'spotify:track:1bL6y85wLp8nB0r5jF6f1m', artists: 'Daft Punk feat. Paul Williams' },
    { id: 'ram-8', name: 'Get Lucky', trackNumber: 8, durationMs: 369000, uri: 'spotify:track:69kOkLUCkxIZYexIgSG8rq', artists: 'Daft Punk feat. Pharrell Williams & Nile Rodgers' },
    { id: 'ram-9', name: 'Beyond', trackNumber: 9, durationMs: 290000, uri: 'spotify:track:03b1P1m4pA8aK7o8sW2t3q', artists: 'Daft Punk' },
    { id: 'ram-10', name: 'Motherboard', trackNumber: 10, durationMs: 341000, uri: 'spotify:track:3t9s1h3wQ5g6l7k8j9m0n1', artists: 'Daft Punk' },
    { id: 'ram-11', name: 'Fragments of Time', trackNumber: 11, durationMs: 279000, uri: 'spotify:track:1vB7x6k7l8m9n0p1q2r3s4', artists: 'Daft Punk feat. Todd Edwards' },
    { id: 'ram-12', name: 'Doin\' it Right', trackNumber: 12, durationMs: 251000, uri: 'spotify:track:36tGhR0g8v8l3v1q1b2c3d', artists: 'Daft Punk feat. Panda Bear' },
    { id: 'ram-13', name: 'Contact', trackNumber: 13, durationMs: 381000, uri: 'spotify:track:1KixkiUAqq2wZ4o8R6m3p8', artists: 'Daft Punk' }
  ],
  'demo-2': [
    { id: 'dsotm-1', name: 'Speak to Me', trackNumber: 1, durationMs: 65000, uri: 'spotify:track:44dGy87Kx0c4bWw6v5u3m0', artists: 'Pink Floyd' },
    { id: 'dsotm-2', name: 'Breathe (In the Air)', trackNumber: 2, durationMs: 169000, uri: 'spotify:track:2ctvdKmETyOzPb2GiJJT53', artists: 'Pink Floyd' },
    { id: 'dsotm-3', name: 'On the Run', trackNumber: 3, durationMs: 225000, uri: 'spotify:track:17d4YfW5r5kL4m0p1q2r3s', artists: 'Pink Floyd' },
    { id: 'dsotm-4', name: 'Time', trackNumber: 4, durationMs: 413000, uri: 'spotify:track:3TO7bbrUKrOSPGRTB5MeCz', artists: 'Pink Floyd' },
    { id: 'dsotm-5', name: 'The Great Gig in the Sky', trackNumber: 5, durationMs: 284000, uri: 'spotify:track:2TjdnqlpwOjhHGtk6UoCU2', artists: 'Pink Floyd' },
    { id: 'dsotm-6', name: 'Money', trackNumber: 6, durationMs: 382000, uri: 'spotify:track:0vfoFDmgm3aT4v7y9M0u2e', artists: 'Pink Floyd' },
    { id: 'dsotm-7', name: 'Us and Them', trackNumber: 7, durationMs: 469000, uri: 'spotify:track:1TKUb23WjBfD2g1q3w4e5r', artists: 'Pink Floyd' },
    { id: 'dsotm-8', name: 'Any Colour You Like', trackNumber: 8, durationMs: 206000, uri: 'spotify:track:03bK1m4pA8aK7o8sW2t3q5', artists: 'Pink Floyd' },
    { id: 'dsotm-9', name: 'Brain Damage', trackNumber: 9, durationMs: 226000, uri: 'spotify:track:05Gv2T6jdssUI6g204F2wS', artists: 'Pink Floyd' },
    { id: 'dsotm-10', name: 'Eclipse', trackNumber: 10, durationMs: 130000, uri: 'spotify:track:3WUp55f9v5W7d5r6t7y8u9', artists: 'Pink Floyd' }
  ],
  'demo-3': [
    { id: 'curr-1', name: 'Let It Happen', trackNumber: 1, durationMs: 466000, uri: 'spotify:track:2X485T9Z5Ly0xyaghY73bv', artists: 'Tame Impala' },
    { id: 'curr-2', name: 'Nangs', trackNumber: 2, durationMs: 107000, uri: 'spotify:track:1vB7x6k7l8m9n0p1q2r3s5', artists: 'Tame Impala' },
    { id: 'curr-3', name: 'The Moment', trackNumber: 3, durationMs: 255000, uri: 'spotify:track:36tGhR0g8v8l3v1q1b2c3e', artists: 'Tame Impala' },
    { id: 'curr-4', name: 'Yes I\'m Changing', trackNumber: 4, durationMs: 270000, uri: 'spotify:track:0dEIa2qtwnqp9CCIgrWgAV', artists: 'Tame Impala' },
    { id: 'curr-5', name: 'Eventually', trackNumber: 5, durationMs: 319000, uri: 'spotify:track:7ycEuFk0PqA7sQyS9f4N02', artists: 'Tame Impala' },
    { id: 'curr-6', name: 'Gossip', trackNumber: 6, durationMs: 55000, uri: 'spotify:track:0oks4FnzhNp5QPTZtoet7L', artists: 'Tame Impala' },
    { id: 'curr-7', name: 'The Less I Know the Better', trackNumber: 7, durationMs: 216000, uri: 'spotify:track:6K4t31amVTZDgR3sKmwUJJ', artists: 'Tame Impala' },
    { id: 'curr-8', name: 'Past Life', trackNumber: 8, durationMs: 227000, uri: 'spotify:track:2cGxRwrMyEAp8dEbuZaVv7', artists: 'Tame Impala' },
    { id: 'curr-9', name: 'Disciples', trackNumber: 9, durationMs: 108000, uri: 'spotify:track:5CMjjywI0eZMixPeqNd75S', artists: 'Tame Impala' },
    { id: 'curr-10', name: '\'Cause I\'m a Man', trackNumber: 10, durationMs: 241000, uri: 'spotify:track:1bL6y85wLp8nB0r5jF6f1n', artists: 'Tame Impala' },
    { id: 'curr-11', name: 'Reality in Motion', trackNumber: 11, durationMs: 252000, uri: 'spotify:track:69kOkLUCkxIZYexIgSG8rr', artists: 'Tame Impala' },
    { id: 'curr-12', name: 'Love/Paranoia', trackNumber: 12, durationMs: 186000, uri: 'spotify:track:03b1P1m4pA8aK7o8sW2t3r', artists: 'Tame Impala' },
    { id: 'curr-13', name: 'New Person, Same Old Mistakes', trackNumber: 13, durationMs: 362000, uri: 'spotify:track:3t9s1h3wQ5g6l7k8j9m0n2', artists: 'Tame Impala' }
  ],
  'demo-4': [
    { id: 'rum-1', name: 'Second Hand News', trackNumber: 1, durationMs: 163000, uri: 'spotify:track:07Gv2T6jdssUI6g204F2wS', artists: 'Fleetwood Mac' },
    { id: 'rum-2', name: 'Dreams', trackNumber: 2, durationMs: 254000, uri: 'spotify:track:0ofHAoxe9vBkTCp2UQIavz', artists: 'Fleetwood Mac' },
    { id: 'rum-3', name: 'Never Going Back Again', trackNumber: 3, durationMs: 134000, uri: 'spotify:track:2ctvdKmETyOzPb2GiJJT54', artists: 'Fleetwood Mac' },
    { id: 'rum-4', name: 'Don\'t Stop', trackNumber: 4, durationMs: 191000, uri: 'spotify:track:3TO7bbrUKrOSPGRTB5MeD0', artists: 'Fleetwood Mac' },
    { id: 'rum-5', name: 'Go Your Own Way', trackNumber: 5, durationMs: 218000, uri: 'spotify:track:07Gv2T6jdssUI6g204F2wT', artists: 'Fleetwood Mac' },
    { id: 'rum-6', name: 'Songbird', trackNumber: 6, durationMs: 200000, uri: 'spotify:track:17d4YfW5r5kL4m0p1q2r3t', artists: 'Fleetwood Mac' },
    { id: 'rum-7', name: 'The Chain', trackNumber: 7, durationMs: 268000, uri: 'spotify:track:5e9TFT0U3CzicDRw2st611', artists: 'Fleetwood Mac' },
    { id: 'rum-8', name: 'You Make Loving Fun', trackNumber: 8, durationMs: 211000, uri: 'spotify:track:2TjdnqlpwOjhHGtk6UoCU3', artists: 'Fleetwood Mac' },
    { id: 'rum-9', name: 'I Don\'t Want to Know', trackNumber: 9, durationMs: 191000, uri: 'spotify:track:0vfoFDmgm3aT4v7y9M0u2f', artists: 'Fleetwood Mac' },
    { id: 'rum-10', name: 'Oh Daddy', trackNumber: 10, durationMs: 234000, uri: 'spotify:track:1TKUb23WjBfD2g1q3w4e5s', artists: 'Fleetwood Mac' },
    { id: 'rum-11', name: 'Gold Dust Woman', trackNumber: 11, durationMs: 291000, uri: 'spotify:track:03bK1m4pA8aK7o8sW2t3q6', artists: 'Fleetwood Mac' }
  ],
  'demo-5': [
    { id: 'abb-1', name: 'Come Together', trackNumber: 1, durationMs: 260000, uri: 'spotify:track:2EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' },
    { id: 'abb-2', name: 'Something', trackNumber: 2, durationMs: 183000, uri: 'spotify:track:0uyA6c1u2iQhK4x2r0m1', artists: 'The Beatles' },
    { id: 'abb-3', name: 'Maxwell\'s Silver Hammer', trackNumber: 3, durationMs: 207000, uri: 'spotify:track:1EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' },
    { id: 'abb-4', name: 'Oh! Darling', trackNumber: 4, durationMs: 206000, uri: 'spotify:track:3EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' },
    { id: 'abb-5', name: 'Octopus\'s Garden', trackNumber: 5, durationMs: 171000, uri: 'spotify:track:4EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' },
    { id: 'abb-6', name: 'I Want You (She\'s So Heavy)', trackNumber: 6, durationMs: 467000, uri: 'spotify:track:5EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' },
    { id: 'abb-7', name: 'Here Comes the Sun', trackNumber: 7, durationMs: 185000, uri: 'spotify:track:6rqhFgbbKwnb9MLmUQDhG6', artists: 'The Beatles' },
    { id: 'abb-8', name: 'Because', trackNumber: 8, durationMs: 165000, uri: 'spotify:track:7EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' },
    { id: 'abb-9', name: 'You Never Give Me Your Money', trackNumber: 9, durationMs: 242000, uri: 'spotify:track:8EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' },
    { id: 'abb-10', name: 'Sun King', trackNumber: 10, durationMs: 146000, uri: 'spotify:track:9EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' },
    { id: 'abb-11', name: 'The End', trackNumber: 11, durationMs: 139000, uri: 'spotify:track:0EqlS6tkEnglzr77xAhP2i', artists: 'The Beatles' }
  ],
  'demo-6': [
    { id: 'kob-1', name: 'So What', trackNumber: 1, durationMs: 562000, uri: 'spotify:track:4vJHQ7k5rK7m0n1p2q3r', artists: 'Miles Davis' },
    { id: 'kob-2', name: 'Freddie Freeloader', trackNumber: 2, durationMs: 589000, uri: 'spotify:track:5vJHQ7k5rK7m0n1p2q3r', artists: 'Miles Davis' },
    { id: 'kob-3', name: 'Blue in Green', trackNumber: 3, durationMs: 337000, uri: 'spotify:track:6vJHQ7k5rK7m0n1p2q3r', artists: 'Miles Davis' },
    { id: 'kob-4', name: 'All Blues', trackNumber: 4, durationMs: 695000, uri: 'spotify:track:7vJHQ7k5rK7m0n1p2q3r', artists: 'Miles Davis' },
    { id: 'kob-5', name: 'Flamenco Sketches', trackNumber: 5, durationMs: 566000, uri: 'spotify:track:8vJHQ7k5rK7m0n1p2q3r', artists: 'Miles Davis' }
  ],
  'demo-7': [
    { id: 'damn-1', name: 'BLOOD.', trackNumber: 1, durationMs: 118000, uri: 'spotify:track:1BLOOD123456789', artists: 'Kendrick Lamar' },
    { id: 'damn-2', name: 'DNA.', trackNumber: 2, durationMs: 185000, uri: 'spotify:track:6HZILIRieu8S0iqY8kIKhj', artists: 'Kendrick Lamar', explicit: true },
    { id: 'damn-3', name: 'YAH.', trackNumber: 3, durationMs: 160000, uri: 'spotify:track:2YAH123456789', artists: 'Kendrick Lamar' },
    { id: 'damn-4', name: 'ELEMENT.', trackNumber: 4, durationMs: 208000, uri: 'spotify:track:3ELEMENT123456789', artists: 'Kendrick Lamar', explicit: true },
    { id: 'damn-5', name: 'FEEL.', trackNumber: 5, durationMs: 214000, uri: 'spotify:track:4FEEL123456789', artists: 'Kendrick Lamar' },
    { id: 'damn-6', name: 'LOYALTY.', trackNumber: 6, durationMs: 227000, uri: 'spotify:track:5LOYALTY123456789', artists: 'Kendrick Lamar feat. Rihanna' },
    { id: 'damn-7', name: 'PRIDE.', trackNumber: 7, durationMs: 275000, uri: 'spotify:track:6PRIDE123456789', artists: 'Kendrick Lamar' },
    { id: 'damn-8', name: 'HUMBLE.', trackNumber: 8, durationMs: 177000, uri: 'spotify:track:7KXjTSCq5nL1LoYtL7XAwS', artists: 'Kendrick Lamar', explicit: true },
    { id: 'damn-9', name: 'LUST.', trackNumber: 9, durationMs: 307000, uri: 'spotify:track:8LUST123456789', artists: 'Kendrick Lamar' },
    { id: 'damn-10', name: 'LOVE.', trackNumber: 10, durationMs: 213000, uri: 'spotify:track:6PGoSes0D9eUDwh9ucv2V9', artists: 'Kendrick Lamar feat. Zacari' },
    { id: 'damn-11', name: 'XXX.', trackNumber: 11, durationMs: 254000, uri: 'spotify:track:0XXX123456789', artists: 'Kendrick Lamar feat. U2', explicit: true },
    { id: 'damn-12', name: 'FEAR.', trackNumber: 12, durationMs: 460000, uri: 'spotify:track:1FEAR123456789', artists: 'Kendrick Lamar' },
    { id: 'damn-13', name: 'GOD.', trackNumber: 13, durationMs: 248000, uri: 'spotify:track:2GOD123456789', artists: 'Kendrick Lamar' },
    { id: 'damn-14', name: 'DUCKWORTH.', trackNumber: 14, durationMs: 248000, uri: 'spotify:track:3DUCKWORTH123456789', artists: 'Kendrick Lamar' }
  ],
  'demo-pl-1': [
    { id: 'dpl1-1', name: 'Midnight City', trackNumber: 1, durationMs: 243000, uri: 'spotify:track:1eyzqe2QqGZUmfcPZtrIyt', artists: 'M83' },
    { id: 'dpl1-2', name: 'Resonance', trackNumber: 2, durationMs: 212000, uri: 'spotify:track:1Z8gS6tqZ19i96c6rR4y2Q', artists: 'HOME' },
    { id: 'dpl1-3', name: 'Sunset Lover', trackNumber: 3, durationMs: 237000, uri: 'spotify:track:3WRQUvzRvBDr4AxMWhXc5E', artists: 'Petit Biscuit' },
    { id: 'dpl1-4', name: 'Chamber of Reflection', trackNumber: 4, durationMs: 231000, uri: 'spotify:track:17VuohUS24yD97w2j7Qo8s', artists: 'Mac DeMarco' },
    { id: 'dpl1-5', name: 'Space Song', trackNumber: 5, durationMs: 320000, uri: 'spotify:track:7H0ya83OXmgAcVXiZfnkWm', artists: 'Beach House' },
    { id: 'dpl1-6', name: 'Fade Into You', trackNumber: 6, durationMs: 295000, uri: 'spotify:track:1LzNfuep1NovFFSVgvSVem', artists: 'Mazzy Star' },
    { id: 'dpl1-7', name: 'Nightcall', trackNumber: 7, durationMs: 259000, uri: 'spotify:track:0U0ldCRmgCqhVvD6ksH633', artists: 'Kavinsky' },
    { id: 'dpl1-8', name: 'Intro', trackNumber: 8, durationMs: 127000, uri: 'spotify:track:2usrT8QIbIk9L098oTVrqS', artists: 'The xx' },
    { id: 'dpl1-9', name: 'Breathe', trackNumber: 9, durationMs: 279000, uri: 'spotify:track:7wD3Z32a4l9pI1j9vKq1bC', artists: 'Télépopmusik' },
    { id: 'dpl1-10', name: 'Teardrop', trackNumber: 10, durationMs: 330000, uri: 'spotify:track:67Hna13dNDkZvBpTXRIaOJ', artists: 'Massive Attack' }
  ],
}