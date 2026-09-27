<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import PanoramicCarousel from '@/components/PanoramicCarousel.vue'
import MediaDetailModal from '@/components/MediaDetailModal.vue'
import { 
  getUserAlbums, 
  getUserPlaylists, 
  getAlbumDetails,
  getPlaylistDetails,
  playContext, 
  getPlaybackState,
  pause,
  play,
  type MediaItem, 
  type MediaItemDetails,
  type TrackItem,
  DEMO_ALBUMS, 
  DEMO_PLAYLISTS 
} from '@/services/spotify'
import { handleRedirectCallback, loginWithSpotify, logout, getAccessToken } from '@/services/auth'
import { extractPaletteFromCover } from '@/utils/colorPalette'

const router = useRouter()

// Authentication & Loading state
const isAuthenticated = ref(false)
const isLoading = ref(true)
const isScopeMissing = ref(false)
const errorMessage = ref<string | null>(null)
const isDemoMode = ref(false)

// Library items
const activeTab = ref<'albums' | 'playlists'>('albums')
const albums = ref<MediaItem[]>([])
const playlists = ref<MediaItem[]>([])
const searchQuery = ref('')
const selectedIndex = ref(0)

// Modal state for album/playlist song details
const isDetailModalOpen = ref(false)
const selectedItemDetails = ref<MediaItemDetails | null>(null)
const isDetailsLoading = ref(false)

// Active playback state
const isPlaying = ref(false)
const currentlyPlayingUri = ref<string>('')
const currentTrackTitle = ref('')
const currentTrackArtist = ref('')
const currentTrackCover = ref('/mirage.webp')
let pollInterval: ReturnType<typeof setInterval> | null = null

// Notification Toast
const toast = reactive({
  show: false,
  message: '',
  type: 'info' as 'info' | 'success' | 'warning' | 'error',
  actionLabel: '',
  actionRoute: '',
  timer: null as ReturnType<typeof setTimeout> | null
})

function showToast(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', actionLabel = '', actionRoute = '') {
  if (toast.timer) clearTimeout(toast.timer)
  toast.message = message
  toast.type = type
  toast.actionLabel = actionLabel
  toast.actionRoute = actionRoute
  toast.show = true
  toast.timer = setTimeout(() => {
    toast.show = false
  }, 6000)
}

// Fluid ambient background colors
const colors = reactive({ primary: '#141419', secondary: '#242038', tertiary: '#1b1b22' })

// Current items according to active tab and search query
const currentCollection = computed(() => {
  return activeTab.value === 'albums' ? albums.value : playlists.value
})

const filteredItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return currentCollection.value
  return currentCollection.value.filter(item => 
    item.title.toLowerCase().includes(query) || 
    item.subtitle.toLowerCase().includes(query)
  )
})

// Current selected item
const activeItem = computed(() => {
  if (filteredItems.value.length === 0) return null
  return filteredItems.value[selectedIndex.value] || filteredItems.value[0] || null
})

// Update ambient background based on active album
watch(() => activeItem.value?.coverUrl, (newUrl) => {
  if (!newUrl) return
  extractPaletteFromCover(newUrl, (extracted) => {
    colors.primary = extracted.primary
    colors.secondary = extracted.secondary
    colors.tertiary = extracted.tertiary
  })
}, { immediate: true })

// Reset carousel index when switching tabs
watch(activeTab, () => {
  selectedIndex.value = 0
  searchQuery.value = ''
})

onMounted(async () => {
  const token = await handleRedirectCallback()
  if (token || getAccessToken()) {
    isAuthenticated.value = true
    await loadLibrary()
    await syncCurrentPlayback()
    pollInterval = setInterval(syncCurrentPlayback, 3500)
  } else {
    // Unauthenticated: load demo library so user can immediately preview 3D carousel
    isDemoMode.value = true
    albums.value = [...DEMO_ALBUMS]
    playlists.value = [...DEMO_PLAYLISTS]
    isLoading.value = false
  }
})

onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
  if (toast.timer) clearTimeout(toast.timer)
})

async function loadLibrary() {
  isLoading.value = true
  errorMessage.value = null
  isScopeMissing.value = false

  try {
    const [albRes, plRes] = await Promise.all([
      getUserAlbums(50),
      getUserPlaylists(50)
    ])

    if (albRes.insufficientScope || plRes.insufficientScope) {
      isScopeMissing.value = true
      albums.value = [...DEMO_ALBUMS]
      playlists.value = [...DEMO_PLAYLISTS]
      isDemoMode.value = true
      isLoading.value = false
      return
    }

    if (albRes.items.length > 0) {
      albums.value = albRes.items
    } else {
      // If user has no saved albums in Spotify, provide demo fallback alongside notification
      albums.value = [...DEMO_ALBUMS]
    }

    if (plRes.items.length > 0) {
      playlists.value = plRes.items
    } else {
      playlists.value = [...DEMO_PLAYLISTS]
    }

    isDemoMode.value = false
  } catch (err: any) {
    console.error('Error loading library:', err)
    errorMessage.value = 'Failed to load Spotify library. Using preview mode.'
    albums.value = [...DEMO_ALBUMS]
    playlists.value = [...DEMO_PLAYLISTS]
    isDemoMode.value = true
  } finally {
    isLoading.value = false
  }
}

async function syncCurrentPlayback() {
  try {
    const state = await getPlaybackState()
    if (!state || !state.item) {
      isPlaying.value = false
      return
    }
    isPlaying.value = state.is_playing
    currentTrackTitle.value = state.item.name
    currentTrackArtist.value = state.item.artists?.map((a: any) => a.name).join(', ') || ''
    currentTrackCover.value = state.item.album?.images?.[0]?.url || '/mirage.webp'
    if (state.context?.uri) {
      currentlyPlayingUri.value = state.context.uri
    }
  } catch (e) {
    console.error('Error syncing playback in library:', e)
  }
}

// When an album gets clicked: sends to Spotify and starts playing
async function handlePlayItem(item: MediaItem) {
  if (!isAuthenticated.value) {
    showToast('Connect Spotify to play this album directly on your account.', 'info')
    loginWithSpotify()
    return
  }

  showToast(`Starting "${item.title}" on Spotify...`, 'info')

  const res = await playContext(item.uri)

  if (res.success) {
    currentlyPlayingUri.value = item.uri
    isPlaying.value = true
    currentTrackTitle.value = item.title
    currentTrackArtist.value = item.subtitle
    currentTrackCover.value = item.coverUrl

    showToast(
      `Now Playing: ${item.title}`, 
      'success', 
      'Watch on Turntable 💽', 
      '/'
    )
    setTimeout(syncCurrentPlayback, 800)
  } else if (res.noActiveDevice) {
    showToast(
      'No active Spotify player found. Please launch Spotify on your PC, phone, or web player.', 
      'warning'
    )
  } else if (res.premiumRequired) {
    showToast(
      'Spotify Premium is required for external playback control.', 
      'warning'
    )
  } else {
    showToast(res.error || 'Failed to start playback on Spotify.', 'error')
  }
}

async function togglePlayback() {
  if (isPlaying.value) {
    await pause()
    isPlaying.value = false
  } else {
    await play()
    isPlaying.value = true
  }
  setTimeout(syncCurrentPlayback, 600)
}

function handleReauthorize() {
  loginWithSpotify()
}

// Open album/playlist detail view with songs, duration, and track count
async function handleOpenItem(item: MediaItem) {
  isDetailModalOpen.value = true
  isDetailsLoading.value = true
  selectedItemDetails.value = null

  try {
    if (item.type === 'album') {
      selectedItemDetails.value = await getAlbumDetails(item.id, item)
    } else {
      selectedItemDetails.value = await getPlaylistDetails(item.id, item)
    }
  } catch (e) {
    console.error('Error fetching details:', e)
  } finally {
    isDetailsLoading.value = false
  }
}

async function handlePlayAll(details: MediaItemDetails) {
  if (!isAuthenticated.value) {
    showToast('Connect Spotify to play this directly on your account.', 'info')
    loginWithSpotify()
    return
  }

  showToast(`Starting "${details.title}" on Spotify...`, 'info')
  const res = await playContext(details.uri)
  if (res.success) {
    currentlyPlayingUri.value = details.uri
    isPlaying.value = true
    currentTrackTitle.value = details.title
    currentTrackArtist.value = details.subtitle
    currentTrackCover.value = details.coverUrl
    showToast(`Now Playing: ${details.title}`, 'success', 'Turntable', '/')
    setTimeout(syncCurrentPlayback, 800)
  } else if (res.noActiveDevice) {
    showToast('No active Spotify player found. Please launch Spotify on your device.', 'warning')
  } else if (res.premiumRequired) {
    showToast('Spotify Premium is required for external playback control.', 'warning')
  } else {
    showToast(res.error || 'Failed to start playback on Spotify.', 'error')
  }
}

async function handlePlayTrack(track: TrackItem, index: number) {
  if (!isAuthenticated.value) {
    showToast('Connect Spotify to play this song.', 'info')
    loginWithSpotify()
    return
  }

  const contextUri = selectedItemDetails.value?.uri || track.uri
  showToast(`Playing "${track.name}"...`, 'info')

  const res = await playContext(contextUri, { position: index })
  if (res.success) {
    currentlyPlayingUri.value = track.uri
    isPlaying.value = true
    currentTrackTitle.value = track.name
    currentTrackArtist.value = track.artists || selectedItemDetails.value?.subtitle || ''
    currentTrackCover.value = selectedItemDetails.value?.coverUrl || currentTrackCover.value
    showToast(`Now Playing: ${track.name}`, 'success', 'Turntable', '/')
    setTimeout(syncCurrentPlayback, 800)
  } else if (res.noActiveDevice) {
    showToast('No active Spotify player found. Please launch Spotify on your device.', 'warning')
  } else if (res.premiumRequired) {
    showToast('Spotify Premium is required for external playback control.', 'warning')
  } else {
    showToast(res.error || 'Failed to start song on Spotify.', 'error')
  }
}
</script>

<template>
  <main
    class="relative flex min-h-screen w-screen flex-col overflow-hidden transition-colors duration-1000 bg-[#0d0e12] select-none"
    :style="{
      '--c1': colors.primary,
      '--c2': colors.secondary,
      '--c3': colors.tertiary,
      backgroundColor: colors.primary
    }"
  >
    <!-- Fluid Animated Background Blobs -->
    <div class="blob blob-1" />
    <div class="blob blob-2" />
    <div class="blob blob-3" />

    <!-- Top Navigation Header -->
    <header class="relative z-50 flex md:flex-row flex-col gap-1 items-center justify-between md:px-12 py-5 w-full">
      <!-- Logo Branding -->
      <router-link to="/" class="flex items-center gap-3 group cursor-pointer">
        <div class="relative w-fit px-2 h-8 rounded-full bg-black/60 border border-white/20 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          <div class="w-3.5 h-3.5 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954]" />
        </div>
        <span class="text-xl font-bold tracking-tight text-white group-hover:text-white/90 transition-colors">
          spinback<span class="text-[#1DB954]">.fm</span>
        </span>
      </router-link>

      <!-- Page Switcher Pill -->
      <nav class="flex items-center p-1 md:absolute md:left-1/2 md:-translate-x-1/2 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl shadow-xl">
        <router-link 
          to="/stats"
          class="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold text-white/60 hover:text-white transition-all cursor-pointer"
        >
          <span>Statistics</span>
        </router-link>

        <router-link 
          to="/"
          class="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold text-white/60 hover:text-white transition-all cursor-pointer"
        >
          <span>Turntable</span>
        </router-link>

        <router-link 
          to="/library"
          class="flex items-center gap-2 px-4 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-semibold bg-white/15 text-white shadow-md border border-white/10 transition-all cursor-pointer"
        >
          <span>Library</span>
        </router-link>
      </nav>

      <!-- Auth Controls -->
      <div class="flex items-center gap-3">
        <template v-if="isAuthenticated">
          <button 
            @click="logout"
            class="text-xs sm:text-sm text-white/50 hover:text-white transition-colors cursor-pointer px-3 py-1.5 rounded-full hover:bg-white/5"
          >
            Log-out
          </button>
        </template>
        <template v-else>
          <button 
            @click="loginWithSpotify"
            class="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black text-xs sm:text-sm font-bold px-4 py-2 rounded-full transition-transform hover:scale-105 cursor-pointer shadow-lg shadow-green-500/20"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.503 17.308c-.218.358-.683.473-1.04.255-2.853-1.743-6.444-2.138-10.673-1.171-.409.094-.817-.16-.91-.569-.094-.408.16-.816.568-.91 4.634-1.059 8.604-.615 11.796 1.336.357.218.472.683.255 1.04.004.019.004.019.004.019zm1.468-3.262c-.274.446-.86.588-1.306.314-3.266-2.008-8.243-2.59-12.106-1.418-.503.153-1.037-.134-1.19-.637-.152-.503.134-1.037.637-1.19 4.417-1.34 9.907-.693 13.65 1.614.446.275.589.86.315 1.307v.03zm.126-3.411c-3.916-2.325-10.37-2.54-14.126-1.399-.6.182-1.239-.161-1.421-.762-.182-.6.161-1.24.762-1.422 4.312-1.309 11.442-1.054 15.949 1.62.541.321.721 1.023.4 1.564-.321.54-1.023.72-1.564.4z"/>
            </svg>
            <span>Connect</span>
          </button>
        </template>
      </div>
    </header>

    <!-- Scope Reconnect Alert if needed -->
    <div 
      v-if="isScopeMissing" 
      class="relative z-40 mx-auto mb-4 max-w-xl px-4 py-2.5 rounded-2xl bg-amber-500/20 border border-amber-400/30 backdrop-blur-md flex items-center justify-between gap-4 text-xs text-amber-200"
    >
      <div class="flex items-center gap-2">
        <span class="text-base">⚠️</span>
        <span>Additional permissions are needed to read your saved Spotify albums.</span>
      </div>
      <button 
        @click="handleReauthorize"
        class="bg-amber-400 hover:bg-amber-300 text-black font-bold px-3 py-1 rounded-full text-xs transition-colors cursor-pointer shrink-0"
      >
        Re-authorize
      </button>
    </div>

    <!-- Subheader: Collection Toggle & Search Filter -->
    <section class="relative z-40 flex flex-col sm:flex-row items-center justify-between gap-4 px-6 md:px-12 mt-2 mb-4 max-w-7xl mx-auto w-full">
      <!-- Albums / Playlists Segmented Pill Switcher -->
      <div class="flex items-center p-1 rounded-full bg-black/40 border border-white/10 backdrop-blur-xl shadow-lg">
        <button
          @click="activeTab = 'albums'"
          class="flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 cursor-pointer"
          :class="activeTab === 'albums' 
            ? 'bg-[#1DB954] text-black shadow-lg shadow-green-500/25' 
            : 'text-white/60 hover:text-white'"
        >
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
          <span>Albums</span>
          <span 
            class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            :class="activeTab === 'albums' ? 'bg-black/20 text-black' : 'bg-white/10 text-white/70'"
          >
            {{ albums.length }}
          </span>
        </button>

        <button
          @click="activeTab = 'playlists'"
          class="flex items-center gap-2 px-5 py-2 rounded-full text-xs md:text-sm font-bold transition-all duration-300 cursor-pointer"
          :class="activeTab === 'playlists' 
            ? 'bg-[#1DB954] text-black shadow-lg shadow-green-500/25' 
            : 'text-white/60 hover:text-white'"
        >
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
          </svg>
          <span>Playlists</span>
          <span 
            class="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            :class="activeTab === 'playlists' ? 'bg-black/20 text-black' : 'bg-white/10 text-white/70'"
          >
            {{ playlists.length }}
          </span>
        </button>
      </div>

      <!-- Quick Search Bar -->
      <div class="relative w-full sm:w-72">
        <input 
          v-model="searchQuery"
          type="text"
          :placeholder="activeTab === 'albums' ? 'Search albums or artists...' : 'Search playlists...'"
          class="w-full bg-black/40 border border-white/15 text-white text-xs md:text-sm rounded-full py-2.5 pl-10 pr-9 backdrop-blur-xl outline-none transition-all shadow-inner"
        />
        <svg class="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <button 
          v-if="searchQuery"
          @click="searchQuery = ''"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
        >
          ✕
        </button>
      </div>
    </section>

    <!-- MAIN SECTION: PANORAMIC 3D CAROUSEL -->
    <section class="relative z-30 flex-1 flex flex-col items-center justify-center w-full px-2">
      <!-- Loading Skeleton -->
      <div v-if="isLoading" class="flex flex-col items-center gap-6 py-20">
        <div class="w-64 h-64 rounded-xl bg-white/5 border border-white/10 animate-pulse flex items-center justify-center">
          <div class="w-12 h-12 rounded-full border-2 border-white/20 border-t-[#1DB954] animate-spin" />
        </div>
        <p class="text-white/50 text-sm tracking-wide">Loading your collection from Spotify...</p>
      </div>

      <!-- Empty Filter State -->
      <div v-else-if="filteredItems.length === 0" class="flex flex-col items-center gap-4 py-24 text-center">
        <div class="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-2xl">
          🔍
        </div>
        <h3 class="text-lg font-bold text-white">No results found for "{{ searchQuery }}"</h3>
        <p class="text-white/50 text-sm max-w-sm">Try searching for a different title or artist, or clear the search filter.</p>
        <button 
          @click="searchQuery = ''"
          class="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors cursor-pointer"
        >
          Clear Search
        </button>
      </div>

      <!-- Panoramic 3D Carousel Component with Border Blurs -->
      <PanoramicCarousel 
        v-else
        :items="filteredItems"
        v-model="selectedIndex"
        :is-playing="isPlaying"
        :currently-playing-uri="currentlyPlayingUri"
        @play="handlePlayItem"
        @open="handleOpenItem"
      />
    </section>

    <!-- Album / Playlist Tracklist Details Modal -->
    <MediaDetailModal 
      :show="isDetailModalOpen"
      :details="selectedItemDetails"
      :is-loading="isDetailsLoading"
      :is-playing="isPlaying"
      :currently-playing-uri="currentlyPlayingUri"
      :current-track-title="currentTrackTitle"
      @close="isDetailModalOpen = false"
      @play-all="handlePlayAll"
      @play-track="handlePlayTrack"
    />

    <!-- Bottom Toast Feedback Notification -->
    <transition name="toast-slide">
      <aside 
        v-if="toast.show" 
        class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-full bg-black/80 border border-white/20 shadow-2xl backdrop-blur-2xl text-white text-sm"
      >
        <span v-if="toast.type === 'success'" class="w-2.5 h-2.5 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954]" />
        <span v-else-if="toast.type === 'warning'" class="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span v-else-if="toast.type === 'error'" class="w-2.5 h-2.5 rounded-full bg-red-500" />
        <span v-else class="w-2.5 h-2.5 rounded-full bg-blue-400" />

        <span class="font-medium drop-shadow">{{ toast.message }}</span>

        <button 
          v-if="toast.actionLabel && toast.actionRoute"
          @click="router.push(toast.actionRoute)"
          class="ml-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-xs px-3 py-1.5 rounded-full cursor-pointer transition-transform hover:scale-105"
        >
          {{ toast.actionLabel }}
        </button>

        <button 
          @click="toast.show = false"
          class="text-white/40 hover:text-white text-xs ml-1 cursor-pointer"
        >
          ✕
        </button>
      </aside>
    </transition>

    <!-- Persistent Bottom Playing Dock (if something is playing) -->
    <div 
      v-if="currentTrackTitle"
      class="absolute bottom-0  z-40 w-full bg-black/40 border-t border-white/10 backdrop-blur-xl px-6 md:px-12 py-2 flex items-center justify-between"
    >
      <div class="flex items-center gap-3 min-w-0">
        <img :src="currentTrackCover" class="w-10 h-10 rounded shadow-md object-cover shrink-0" alt="" />
        <div class="min-w-0">
          <p class="text-xs sm:text-sm font-bold text-white truncate">{{ currentTrackTitle }}</p>
          <p class="text-[11px] text-white/60 truncate">{{ currentTrackArtist }}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="togglePlayback"
          class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-transform active:scale-95"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
        >
          <svg v-if="isPlaying" class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
          <svg v-else class="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>

        <router-link 
          to="/"
          class="hidden sm:flex items-center gap-1.5 text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 cursor-pointer transition-all"
        >
          <span>Open Turntable</span>
          <span>💽</span>
        </router-link>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Ambient liquid blobs matching turntable experience */
.blob {
  position: absolute;
  border-radius: 50%;
  mix-blend-mode: color-dodge;
  filter: blur(70px);
  opacity: 0.65;
  will-change: transform, border-radius;
  pointer-events: none;
}

.blob-1 { width: 55%; height: 60%; background: var(--c2); top: -10%;  left: -10%;  animation: blob1 16s ease-in-out infinite; }
.blob-2 { width: 60%; height: 55%; background: var(--c3); bottom: -15%; right: -15%; animation: blob2 18s ease-in-out infinite; }
.blob-3 { width: 45%; height: 50%; background: var(--c1); top: 25%;   left: 25%;   animation: blob3 20s ease-in-out infinite; }

@keyframes blob1 {
  0%,100% { transform: translate(0%,0%)     scale(1);    border-radius: 60% 40% 70% 30% / 50% 60% 40% 50%; }
  25%     { transform: translate(50%,20%)   scale(1.1);  border-radius: 40% 60% 30% 70% / 60% 40% 70% 30%; }
  50%     { transform: translate(25%,55%)   scale(0.9);  border-radius: 70% 30% 50% 50% / 30% 70% 40% 60%; }
  75%     { transform: translate(-10%,30%)  scale(1.05); border-radius: 50% 50% 40% 60% / 40% 60% 50% 50%; }
}

@keyframes blob2 {
  0%,100% { transform: translate(0%,0%)     scale(1);    border-radius: 40% 60% 50% 50% / 60% 40% 55% 45%; }
  30%     { transform: translate(-35%,25%)  scale(1.15); border-radius: 60% 40% 30% 70% / 40% 70% 30% 60%; }
  60%     { transform: translate(-15%,-35%) scale(0.85); border-radius: 30% 70% 60% 40% / 50% 30% 70% 50%; }
  80%     { transform: translate(15%,-15%)  scale(1.1);  border-radius: 55% 45% 40% 60% / 35% 65% 50% 50%; }
}

@keyframes blob3 {
  0%,100% { transform: translate(0%,0%)    scale(1);    border-radius: 50% 50% 60% 40% / 40% 60% 50% 50%; }
  20%     { transform: translate(25%,-45%) scale(1.2);  border-radius: 70% 30% 40% 60% / 60% 40% 60% 40%; }
  55%     { transform: translate(-25%,-15%)scale(0.8);  border-radius: 35% 65% 55% 45% / 65% 35% 45% 55%; }
  80%     { transform: translate(10%,35%)  scale(1.1);  border-radius: 60% 40% 35% 65% / 45% 55% 60% 40%; }
}

@media (prefers-reduced-motion: reduce) {
  .blob { animation: none; }
}

/* Toast animations */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px) scale(0.95);
}
</style>
