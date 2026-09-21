const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = 'http://127.0.0.1:5173' 
const SCOPES = 'user-read-playback-state user-modify-playback-state'

function generateRandomString(length: number) {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc, x) => acc + possible[x % possible.length], "")
}

async function sha256(plain: string) {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return window.crypto.subtle.digest('SHA-256', data)
}

function base64encode(input: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

export async function loginWithSpotify() {
  const codeVerifier = generateRandomString(64)
  localStorage.setItem('code_verifier', codeVerifier)
  
  const hashed = await sha256(codeVerifier)
  const codeChallenge = base64encode(hashed)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  })

  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function handleRedirectCallback(): Promise<string | null> {
  const urlParams = new URLSearchParams(window.location.search)
  const code = urlParams.get('code')
  
  if (!code) {
    window.history.replaceState({}, document.title, '/')
    return localStorage.getItem('spotify_token')
  }

  const codeVerifier = localStorage.getItem('code_verifier')
  
  const payload = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier || '',
  })

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: payload
    })

    const data = await response.json()
    if (data.access_token) {
      localStorage.setItem('spotify_token', data.access_token)
      window.history.replaceState({}, document.title, '/')
      return data.access_token
    }
  } catch (e) {
    console.error('Error switching code for token:', e)
  }
  
  return null
}

export function logout() {
  localStorage.removeItem('spotify_token')
  window.location.reload()
}

export function getAccessToken() {
  return localStorage.getItem('spotify_token')
}