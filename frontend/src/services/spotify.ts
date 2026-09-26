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

export async function play(contextUri?: string): Promise<PlayResult> {
  const token = getAccessToken()
  if (!token) return { success: false, error: 'Not authenticated' }

  try {
    const body = contextUri ? JSON.stringify({ context_uri: contextUri }) : undefined
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

export async function playContext(contextUri: string): Promise<PlayResult> {
  return play(contextUri)
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
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:album:4m2880jivSbbyEGAKfITCa',
    type: 'album',
    tracksCount: 13
  },
  {
    id: 'demo-2',
    title: 'The Dark Side of the Moon',
    subtitle: 'Pink Floyd',
    year: '1973',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:album:4LH4d3cOWNNXdsqFd4G7gv',
    type: 'album',
    tracksCount: 10
  },
  {
    id: 'demo-3',
    title: 'Currents',
    subtitle: 'Tame Impala',
    year: '2015',
    coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:album:79dL7FLiJFOO0EoehUHQBv',
    type: 'album',
    tracksCount: 13
  },
  {
    id: 'demo-4',
    title: 'Rumours',
    subtitle: 'Fleetwood Mac',
    year: '1977',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:album:1bt6q2S3hk52zNVq0MYYoq',
    type: 'album',
    tracksCount: 11
  },
  {
    id: 'demo-5',
    title: 'Abbey Road',
    subtitle: 'The Beatles',
    year: '1969',
    coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:album:0ETFjA39vXvRwEhG97Y6TN',
    type: 'album',
    tracksCount: 17
  },
  {
    id: 'demo-6',
    title: 'Kind of Blue',
    subtitle: 'Miles Davis',
    year: '1959',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:album:1weenldGlxKi6kEN9IR9UF',
    type: 'album',
    tracksCount: 5
  },
  {
    id: 'demo-7',
    title: 'DAMN.',
    subtitle: 'Kendrick Lamar',
    year: '2017',
    coverUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:album:4eLPsYPBmXABThSJ821sqY',
    type: 'album',
    tracksCount: 14
  }
]

export const DEMO_PLAYLISTS: MediaItem[] = [
  {
    id: 'demo-pl-1',
    title: 'Late Night Vinyl Sessions',
    subtitle: 'By Spinback Curators',
    coverUrl: 'https://images.unsplash.com/photo-1539375665275-f9de415ef9ac?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:playlist:37i9dQZF1DXcBWIGoYBM5M',
    type: 'playlist',
    tracksCount: 38
  },
  {
    id: 'demo-pl-2',
    title: 'Analog Warmth & Chill',
    subtitle: 'By Audiophile Vault',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:playlist:37i9dQZF1DX4WYpdgoIcn6',
    type: 'playlist',
    tracksCount: 50
  },
  {
    id: 'demo-pl-3',
    title: 'Japanese City Pop & Funk',
    subtitle: 'By Tokyo Groove',
    coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=600&auto=format&fit=crop&q=80',
    uri: 'spotify:playlist:37i9dQZF1DXdbXrPNafg9d',
    type: 'playlist',
    tracksCount: 42
  }
]