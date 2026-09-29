<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AlbumFrame from '@/components/AlbumFrame.vue'
import ArtistFrame from '@/components/ArtistFrame.vue'
import RecentTracksList from '@/components/RecentTracksList.vue'
import TopTracksList from '@/components/TopTracksList.vue'
import { 
  getPlaybackState, 
  getTopTracks, 
  getTopArtists, 
  getTopAlbums, 
  aggregateTopAlbums,
  getRecentlyPlayed, 
  playTrack,
  playContext,
  type TimeRange,
  type TopTrackItem,
  type TopArtistItem,
  type TopAlbumItem,
  type RecentlyPlayedItem
} from '@/services/spotify'
import { handleRedirectCallback, loginWithSpotify, logout, getAccessToken } from '@/services/auth'
import { extractPaletteFromCover } from '@/utils/colorPalette'

const route = useRoute()

const isAuthenticated = ref(false)
const isLoading = ref(true)
const isScopeMissing = ref(false)

const selectedTimeRange = ref<TimeRange>('short_term')
const activeSection = ref<'all' | 'artists' | 'albums' | 'tracks' | 'recent'>('all')

const topTracks = ref<TopTrackItem[]>([])
const topArtists = ref<TopArtistItem[]>([])
const topAlbums = ref<TopAlbumItem[]>([])
const recentTracks = ref<RecentlyPlayedItem[]>([])

const currentTrack = reactive({
  title: 'Analog Space',
  artist: 'Spinback Ambient',
  album: 'Vinyl Echoes',
  coverUrl: '/mirage.webp',
  isPlaying: false,
  uri: ''
})

const colors = reactive({ 
  primary: '#12131a', 
  secondary: '#25213b', 
  tertiary: '#191826' 
})

let pollInterval: ReturnType<typeof setInterval> | null = null

const toast = reactive({
  show: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'warning' | 'error',
  timer: null as ReturnType<typeof setTimeout> | null
})

function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
  if (toast.timer) clearTimeout(toast.timer)
  toast.message = message
  toast.type = type
  toast.show = true
  toast.timer = setTimeout(() => {
    toast.show = false
  }, 4500)
}

watch(() => currentTrack.coverUrl, (newUrl) => {
  if (!newUrl) return
  extractPaletteFromCover(newUrl, (extracted) => {
    colors.primary = extracted.primary
    colors.secondary = extracted.secondary
    colors.tertiary = extracted.tertiary
  })
}, { immediate: true })

watch(selectedTimeRange, async (newRange) => {
  if (isAuthenticated.value) {
    await loadTimeRangedStats(newRange)
  }
})

onMounted(async () => {
  const token = await handleRedirectCallback()
  if (token || getAccessToken()) {
    isAuthenticated.value = true
    await loadAllStats()
    await syncSpotifyPlayback()
    pollInterval = setInterval(syncSpotifyPlayback, 3500)
  } else {
    isAuthenticated.value = false
    isLoading.value = false
  }
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  if (toast.timer) clearTimeout(toast.timer)
})

async function syncSpotifyPlayback() {
  try {
    const state = await getPlaybackState()
    if (!state?.item) return

    currentTrack.title = state.item.name || 'Unknown Track'
    currentTrack.artist = state.item.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist'
    currentTrack.album = state.item.album?.name || ''
    currentTrack.isPlaying = state.is_playing
    currentTrack.uri = state.item.uri || ''

    const cover = state.item.album?.images?.[0]?.url
    if (cover && currentTrack.coverUrl !== cover) {
      currentTrack.coverUrl = cover
    }
  } catch (err) {
    console.error('syncSpotifyPlayback error:', err)
  }
}

async function loadAllStats() {
  isLoading.value = true
  isScopeMissing.value = false

  try {
    await Promise.all([
      loadTimeRangedStats(selectedTimeRange.value),
      loadRecentlyPlayed()
    ])

    if (!currentTrack.isPlaying && topTracks.value.length > 0 && currentTrack.coverUrl === '/mirage.webp') {
      currentTrack.title = topTracks.value[0]?.name || currentTrack.title
      currentTrack.artist = topTracks.value[0]?.artists || currentTrack.artist
      currentTrack.album = topTracks.value[0]?.albumName || currentTrack.album
      currentTrack.coverUrl = topTracks.value[0]?.coverUrl || currentTrack.coverUrl
    }
  } finally {
    isLoading.value = false
  }
}

async function loadTimeRangedStats(range: TimeRange) {
  try {
    const [tracksRes, artistsRes] = await Promise.all([
      getTopTracks(range, 50),
      getTopArtists(range, 5)
    ])

    if (tracksRes.insufficientScope || artistsRes.insufficientScope) {
      isScopeMissing.value = true
    }

    const allTracks = tracksRes.items || []
    topTracks.value = allTracks.slice(0, 10)
    topArtists.value = artistsRes.items || []
    topAlbums.value = aggregateTopAlbums(allTracks, 5)
  } catch (e) {
    console.error('Error loading time ranged stats:', e)
    topTracks.value = []
    topArtists.value = []
    topAlbums.value = []
  }
}

async function loadRecentlyPlayed() {
  try {
    const res = await getRecentlyPlayed(10)
    if (res.insufficientScope) {
      isScopeMissing.value = true
    }
    recentTracks.value = res.items || []
  } catch (e) {
    console.error('Error loading recently played:', e)
    recentTracks.value = []
  }
}

async function handlePlayTrack(track: TopTrackItem | RecentlyPlayedItem) {
  const trackName = 'name' in track ? track.name : track.trackName
  if (!isAuthenticated.value) return

  showToast(`Spinning "${trackName}"...`, 'info')
  const res = await playTrack(track.uri)
  if (res.success) {
    currentTrack.title = trackName
    currentTrack.artist = track.artists
    currentTrack.album = track.albumName
    currentTrack.coverUrl = track.coverUrl
    currentTrack.isPlaying = true
    currentTrack.uri = track.uri
    setTimeout(syncSpotifyPlayback, 800)
  } else {
    showToast(res.error || 'Open Spotify to activate playback', 'warning')
  }
}

async function handlePlayAlbum(album: TopAlbumItem) {
  if (!isAuthenticated.value) return

  showToast(`Spinning album "${album.name}"...`, 'info')
  const res = await playContext(album.uri)
  if (res.success) {
    currentTrack.coverUrl = album.coverUrl
    currentTrack.album = album.name
    currentTrack.artist = album.artist
    currentTrack.isPlaying = true
    setTimeout(syncSpotifyPlayback, 800)
  } else {
    showToast(res.error || 'Open Spotify to activate playback', 'warning')
  }
}

function handleSelectArtist(artist: TopArtistItem) {
  showToast(`Top artist: ${artist.name} (${artist.popularity}% popularity)`, 'info')
}
</script>

<template>
  <main
    class="relative flex no-scrollbar h-screen w-screen flex-col overflow-x-hidden transition-colors duration-1000 bg-[#0c0d12] text-white selection:bg-[#1DB954] selection:text-black"
    :style="{
      '--c1': colors.primary,
      '--c2': colors.secondary,
      '--c3': colors.tertiary,
      backgroundColor: colors.primary
    }"
  >
    <div class="blob blob-1" />
    <div class="blob blob-2" />
    <div class="blob blob-3" />

    <header class="relative z-50 flex md:flex-row flex-col gap-2 items-center justify-between md:px-12 py-5 w-full">
      <router-link to="/" class="flex items-center gap-3 group cursor-pointer">
        <div class="relative w-8 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <div class="w-3.5 h-3.5 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954]" />
        </div>
        <span class="text-xl font-bold tracking-tight text-white group-hover:text-white/90 transition-colors">
          spinback<span class="text-[#1DB954]">.fm</span>
        </span>
      </router-link>

      <nav class="flex items-center p-1 md:absolute md:left-1/2 md:-translate-x-1/2 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl shadow-xl">
        <router-link 
          to="/stats"
          :class="[
            'flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer',
            route.path === '/stats'
              ? 'bg-white/15 text-white shadow-md border border-white/10'
              : 'text-white/60 hover:text-white'
          ]"
        >
          <span>Statistics</span>
        </router-link>

        <router-link 
          to="/"
          :class="[
            'flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer',
            route.path === '/'
              ? 'bg-white/15 text-white shadow-md border border-white/10'
              : 'text-white/60 hover:text-white'
          ]"
        >
          <span>Turntable</span>
        </router-link>

        <router-link 
          to="/library"
          :class="[
            'flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all cursor-pointer',
            route.path === '/library'
              ? 'bg-white/15 text-white shadow-md border border-white/10'
              : 'text-white/60 hover:text-white'
          ]"
        >
          <span>Library</span>
        </router-link>
      </nav>

      <div class="flex items-center gap-3">
        <button 
          v-if="isAuthenticated" 
          @click="logout" 
          class="text-xs sm:text-sm text-white/50 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-full hover:bg-white/5"
        >
          Log-out
        </button>
        <button 
          v-else
          @click="loginWithSpotify" 
          class="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs sm:text-sm font-bold px-4 py-2 rounded-full transition-transform hover:scale-105 cursor-pointer shadow-lg shadow-green-500/20"
        >
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.218.358-.683.473-1.04.255-2.853-1.743-6.444-2.138-10.673-1.171-.409.094-.817-.16-.91-.569-.094-.408.16-.816.568-.91 4.634-1.059 8.604-.615 11.796 1.336.357.218.472.683.255 1.04.004.019.004.019.004.019zm1.468-3.262c-.274.446-.86.588-1.306.314-3.266-2.008-8.243-2.59-12.106-1.418-.503.153-1.037-.134-1.19-.637-.152-.503.134-1.037.637-1.19 4.417-1.34 9.907-.693 13.65 1.614.446.275.589.86.315 1.307v.03zm.126-3.411c-3.916-2.325-10.37-2.54-14.126-1.399-.6.182-1.239-.161-1.421-.762-.182-.6.161-1.24.762-1.422 4.312-1.309 11.442-1.054 15.949 1.62.541.321.721 1.023.4 1.564-.321.54-1.023.72-1.564.4z"/>
          </svg>
          <span>Login</span>
        </button>
      </div>
    </header>

    <div 
      v-if="!isAuthenticated" 
      class="relative z-20 flex flex-col items-center justify-center flex-1 max-w-md mx-auto px-6 py-24 text-center my-auto"
    >
      <div class="relative w-24 h-24 mb-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center shadow-2xl backdrop-blur-md">
        <div class="w-12 h-12 rounded-full bg-[#1DB954] shadow-[0_0_30px_rgba(29,185,84,0.5)] flex items-center justify-center">
          <svg class="w-6 h-6 text-black fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.218.358-.683.473-1.04.255-2.853-1.743-6.444-2.138-10.673-1.171-.409.094-.817-.16-.91-.569-.094-.408.16-.816.568-.91 4.634-1.059 8.604-.615 11.796 1.336.357.218.472.683.255 1.04.004.019.004.019.004.019zm1.468-3.262c-.274.446-.86.588-1.306.314-3.266-2.008-8.243-2.59-12.106-1.418-.503.153-1.037-.134-1.19-.637-.152-.503.134-1.037.637-1.19 4.417-1.34 9.907-.693 13.65 1.614.446.275.589.86.315 1.307v.03zm.126-3.411c-3.916-2.325-10.37-2.54-14.126-1.399-.6.182-1.239-.161-1.421-.762-.182-.6.161-1.24.762-1.422 4.312-1.309 11.442-1.054 15.949 1.62.541.321.721 1.023.4 1.564-.321.54-1.023.72-1.564.4z"/>
          </svg>
        </div>
      </div>

      <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
        Statistics
      </h1>
      <p class="text-sm text-white/50 mb-8 max-w-xs font-light leading-relaxed">
        Connect your Spotify account to reveal your personal listening insights.
      </p>

      <button 
        @click="loginWithSpotify" 
        class="flex items-center gap-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold px-8 py-3.5 rounded-full transition-all duration-300 hover:scale-105 cursor-pointer shadow-xl shadow-green-500/25 text-sm uppercase tracking-wider"
      >
        <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24">
          <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.218.358-.683.473-1.04.255-2.853-1.743-6.444-2.138-10.673-1.171-.409.094-.817-.16-.91-.569-.094-.408.16-.816.568-.91 4.634-1.059 8.604-.615 11.796 1.336.357.218.472.683.255 1.04.004.019.004.019.004.019zm1.468-3.262c-.274.446-.86.588-1.306.314-3.266-2.008-8.243-2.59-12.106-1.418-.503.153-1.037-.134-1.19-.637-.152-.503.134-1.037.637-1.19 4.417-1.34 9.907-.693 13.65 1.614.446.275.589.86.315 1.307v.03zm.126-3.411c-3.916-2.325-10.37-2.54-14.126-1.399-.6.182-1.239-.161-1.421-.762-.182-.6.161-1.24.762-1.422 4.312-1.309 11.442-1.054 15.949 1.62.541.321.721 1.023.4 1.564-.321.54-1.023.72-1.564.4z"/>
        </svg>
        <span>Login</span>
      </button>
    </div>

    <template v-else>
      <div 
        v-if="isScopeMissing" 
        class="relative z-40 mx-auto mb-4 max-w-2xl px-5 py-3 rounded-2xl bg-amber-500/20 border border-amber-400/30 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 text-xs text-amber-200 shadow-xl"
      >
        <div class="flex items-center gap-3">
          <span class="text-lg">✨</span>
          <div>
            <span class="font-bold">Grant Statistics Scope:</span>
            <span> Reconnect Spotify to sync your personalized top artists, albums, and recent tracks.</span>
          </div>
        </div>
        <button 
          @click="loginWithSpotify" 
          class="bg-amber-400 text-black font-semibold px-3 py-1.5 rounded-full hover:bg-amber-300 transition-colors cursor-pointer text-xs"
        >
          Reconnect
        </button>
      </div>

      <div class="relative z-20 flex flex-col flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 pb-24">
        <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-white/10">
          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-mono uppercase tracking-widest text-[#1DB954] font-semibold">Soundscape Analytics</span>
            </div>
            <h1 class="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-tight">
              Listening Statistics
            </h1>
            <p class="text-xs sm:text-sm text-white/50 max-w-md font-light">
              Your most played records, artists, and recent spins, what is spinning now.
            </p>
          </div>

          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div class="flex flex-col gap-1.5">
              <span class="text-[10px] font-mono text-white/40 uppercase tracking-wider">Selectable Period</span>
              <div class="inline-flex p-1 rounded-full bg-black/40 border border-white/15 backdrop-blur-xl shadow-lg">
                <button
                  type="button"
                  @click="selectedTimeRange = 'short_term'"
                  :class="[
                    'px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                    selectedTimeRange === 'short_term'
                      ? 'bg-white/20 text-white shadow border border-white/15'
                      : 'text-white/50 hover:text-white'
                  ]"
                >
                  4 Weeks
                </button>

                <button
                  type="button"
                  @click="selectedTimeRange = 'medium_term'"
                  :class="[
                    'px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                    selectedTimeRange === 'medium_term'
                      ? 'bg-white/20 text-white shadow border border-white/15'
                      : 'text-white/50 hover:text-white'
                  ]"
                >
                  6 Months
                </button>

                <button
                  type="button"
                  @click="selectedTimeRange = 'long_term'"
                  :class="[
                    'px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer',
                    selectedTimeRange === 'long_term'
                      ? 'bg-white/20 text-white shadow border border-white/15'
                      : 'text-white/50 hover:text-white'
                  ]"
                >
                  1 Year
                </button>
              </div>
            </div>

            <div class="flex flex-col gap-1.5">
              <span class="text-[10px] font-mono text-white/40 uppercase tracking-wider">Last Song</span>
              <div class="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-black/40 border border-white/15 backdrop-blur-xl shadow-lg">
                <img 
                  :src="currentTrack.coverUrl" 
                  :alt="currentTrack.title" 
                  class="w-6 h-6 rounded-full object-cover shadow border border-white/20"
                />
                
                <div class="flex flex-col max-w-30 sm:max-w-37.5">
                  <span class="text-[11px] font-medium text-white truncate leading-tight">
                    {{ currentTrack.title }}
                  </span>
                  <span class="text-[9px] text-white/50 truncate leading-tight">
                    {{ currentTrack.artist }}
                  </span>
                </div>

                <div class="flex items-end gap-0.5 h-3 ml-1 shrink-0">
                  <span class="w-0.5 bg-[#1DB954] h-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                  <span class="w-0.5 bg-[#1DB954] h-2 animate-[pulse_0.4s_ease-in-out_infinite_0.2s]" />
                  <span class="w-0.5 bg-[#1DB954] h-full animate-[pulse_0.5s_ease-in-out_infinite_0.1s]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 overflow-x-auto py-4 scrollbar-none border-b border-white/5">
          <button
            type="button"
            @click="activeSection = 'all'"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer',
              activeSection === 'all'
                ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                : 'text-white/50 hover:text-white bg-white/5'
            ]"
          >
            Overview
          </button>

          <button
            type="button"
            @click="activeSection = 'artists'"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer',
              activeSection === 'artists'
                ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                : 'text-white/50 hover:text-white bg-white/5'
            ]"
          >
            Top Artists ({{ topArtists.length }})
          </button>

          <button
            type="button"
            @click="activeSection = 'albums'"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer',
              activeSection === 'albums'
                ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                : 'text-white/50 hover:text-white bg-white/5'
            ]"
          >
            Top Albums ({{ topAlbums.length }})
          </button>

          <button
            type="button"
            @click="activeSection = 'tracks'"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer',
              activeSection === 'tracks'
                ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                : 'text-white/50 hover:text-white bg-white/5'
            ]"
          >
            Top Songs ({{ topTracks.length }})
          </button>

          <button
            type="button"
            @click="activeSection = 'recent'"
            :class="[
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer',
              activeSection === 'recent'
                ? 'bg-white/15 text-white border border-white/15 shadow-sm'
                : 'text-white/50 hover:text-white bg-white/5'
            ]"
          >
            Recent Songs ({{ recentTracks.length }})
          </button>
        </div>

        <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-4">
          <div class="w-10 h-10 border-2 border-white/20 border-t-[#1DB954] rounded-full animate-spin" />
          <span class="text-xs font-mono text-white/50">Analyzing your Spotify statistics...</span>
        </div>

        <template v-else>
          <section 
            v-if="activeSection === 'all' || activeSection === 'artists'"
            class="mt-10 flex flex-col gap-5"
          >
            <div class="flex items-end justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-[#1DB954]" />
                  <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-white">Top 5 Artists</h2>
                </div>
                <p class="text-xs text-white/50 font-light mt-0.5">
                  Your 5 most played artists for this {{ selectedTimeRange === 'short_term' ? '4-week' : selectedTimeRange === 'medium_term' ? '6-month' : '1-year' }} period
                </p>
              </div>
              <span class="text-xs font-mono text-white/40">{{ topArtists.length }} artists</span>
            </div>

            <div v-if="topArtists.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
              <ArtistFrame 
                v-for="(artist, idx) in topArtists"
                :key="artist.id"
                :artist="artist"
                :rank="idx + 1"
                @select="handleSelectArtist"
              />
            </div>
            <div v-else class="text-center py-10 text-white/40 text-xs font-mono">
              No top artist data found for this period.
            </div>
          </section>

          <section 
            v-if="activeSection === 'all' || activeSection === 'albums'"
            class="mt-14 flex flex-col gap-5"
          >
            <div class="flex items-end justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-400" />
                  <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-white">Top 5 Albums</h2>
                </div>
                <p class="text-xs text-white/50 font-light mt-0.5">
                  Your 5 most played albums for this {{ selectedTimeRange === 'short_term' ? '4-week' : selectedTimeRange === 'medium_term' ? '6-month' : '1-year' }} period
                </p>
              </div>
              <span class="text-xs font-mono text-white/40">{{ topAlbums.length }} albums</span>
            </div>

            <div v-if="topAlbums.length > 0" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5">
              <AlbumFrame 
                v-for="(album, idx) in topAlbums"
                :key="album.id"
                :album="album"
                :rank="idx + 1"
                :is-playing="currentTrack.album === album.name && currentTrack.isPlaying"
                @play="handlePlayAlbum"
              />
            </div>
            <div v-else class="text-center py-10 text-white/40 text-xs font-mono">
              No top album data found for this period.
            </div>
          </section>

          <div 
            v-if="activeSection === 'all' || activeSection === 'tracks' || activeSection === 'recent'"
            class="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-10"
          >
            <section 
              v-if="activeSection === 'all' || activeSection === 'tracks'"
              class="flex flex-col gap-4"
            >
              <div class="flex items-end justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-sky-400" />
                    <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-white">Top 10 Songs</h2>
                  </div>
                  <p class="text-xs text-white/50 font-light mt-0.5">
                    Your most played tracks ranking with play count
                  </p>
                </div>
              </div>

              <TopTracksList 
                v-if="topTracks.length > 0"
                :tracks="topTracks"
                :current-track-uri="currentTrack.uri"
                :is-playing="currentTrack.isPlaying"
                @play="handlePlayTrack"
              />
              <div v-else class="text-center py-10 text-white/40 text-xs font-mono">
                No top song data found for this period.
              </div>
            </section>

            <section 
              v-if="activeSection === 'all' || activeSection === 'recent'"
              class="flex flex-col gap-4"
            >
              <div class="flex items-end justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-400" />
                    <h2 class="text-xl sm:text-2xl font-bold tracking-tight text-white">Recent Songs</h2>
                  </div>
                  <p class="text-xs text-white/50 font-light mt-0.5">
                    Your 10 most recent spins
                  </p>
                </div>
              </div>

              <RecentTracksList 
                v-if="recentTracks.length > 0"
                :tracks="recentTracks"
                :current-track-uri="currentTrack.uri"
                :is-playing="currentTrack.isPlaying"
                @play="handlePlayTrack"
              />
              <div v-else class="text-center py-10 text-white/40 text-xs font-mono">
                No recent listening history found.
              </div>
            </section>
          </div>
        </template>
      </div>
    </template>

    <transition name="toast-fade">
      <div 
        v-if="toast.show" 
        class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/85 border border-white/20 backdrop-blur-xl shadow-2xl text-xs sm:text-sm text-white"
      >
        <span v-if="toast.type === 'success'" class="text-emerald-400">●</span>
        <span v-else-if="toast.type === 'warning'" class="text-amber-400">●</span>
        <span v-else class="text-[#1DB954]">●</span>
        <span>{{ toast.message }}</span>
      </div>
    </transition>
  </main>
</template>

<style scoped>
.blob {
  position: fixed;
  border-radius: 50%;
  mix-blend-mode: color-dodge;
  filter: blur(75px);
  opacity: 0.65;
  will-change: transform, border-radius;
  pointer-events: none;
}

.blob-1 { width: 55vw; height: 60vh; background: var(--c2); top: -10%; left: -10%; animation: blob1 18s ease-in-out infinite; }
.blob-2 { width: 60vw; height: 55vh; background: var(--c3); bottom: -15%; right: -15%; animation: blob2 20s ease-in-out infinite; }
.blob-3 { width: 45vw; height: 45vh; background: var(--c1); top: 35%; left: 30%; animation: blob3 22s ease-in-out infinite; }

@keyframes blob1 {
  0%,100% { transform: translate(0%,0%) scale(1); border-radius: 60% 40% 70% 30% / 50% 60% 40% 50%; }
  25% { transform: translate(35%,15%) scale(1.1); border-radius: 40% 60% 30% 70% / 60% 40% 70% 30%; }
  50% { transform: translate(20%,45%) scale(0.9); border-radius: 70% 30% 50% 50% / 30% 70% 40% 60%; }
  75% { transform: translate(-10%,25%) scale(1.05); border-radius: 50% 50% 40% 60% / 40% 60% 50% 50%; }
}

@keyframes blob2 {
  0%,100% { transform: translate(0%,0%) scale(1); border-radius: 40% 60% 50% 50% / 60% 40% 55% 45%; }
  30% { transform: translate(-30%,20%) scale(1.15); border-radius: 60% 40% 30% 70% / 40% 70% 30% 60%; }
  60% { transform: translate(-15%,-30%) scale(0.85); border-radius: 30% 70% 60% 40% / 50% 30% 70% 50%; }
  80% { transform: translate(15%,-15%) scale(1.1); border-radius: 55% 45% 40% 60% / 35% 65% 50% 50%; }
}

@keyframes blob3 {
  0%,100% { transform: translate(0%,0%) scale(1); border-radius: 50% 50% 60% 40% / 40% 60% 50% 50%; }
  20% { transform: translate(20%,-35%) scale(1.2); border-radius: 70% 30% 40% 60% / 60% 40% 60% 40%; }
  55% { transform: translate(-20%,-15%) scale(0.8); border-radius: 35% 65% 55% 45% / 65% 35% 45% 55%; }
  80% { transform: translate(10%,30%) scale(1.1); border-radius: 60% 40% 35% 65% / 45% 55% 60% 40%; }
}

.toast-fade-enter-active,
.toast-fade-leave-active {
  transition: all 0.3s ease;
}

.toast-fade-enter-from,
.toast-fade-leave-to {
  opacity: 0;
  transform: translateY(12px);
}

@media (prefers-reduced-motion: reduce) {
  .blob { animation: none; }
}
</style>
