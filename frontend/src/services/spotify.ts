import { getAccessToken } from './auth'

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
}

export async function play() {
  await fetch('https://api.spotify.com/v1/me/player/play', { method: 'PUT', headers: getHeaders() })
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