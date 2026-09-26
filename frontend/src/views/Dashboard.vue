<script setup lang="ts">
import VinylPlayer from '@/components/VinylPlayer.vue'
import { ref, onMounted, onUnmounted, reactive, watch } from 'vue'
import { getPlaybackState, play, pause, seek, nextTrack, previousTrack } from '@/services/spotify'
import { handleRedirectCallback, loginWithSpotify, logout } from '@/services/auth'
import { extractPaletteFromCover } from '@/utils/colorPalette'

const isAuthenticated = ref(false)

onMounted(async () => {
  const token = await handleRedirectCallback()
  
  if (token) {
    isAuthenticated.value = true
    syncSpotify()
    pollInterval = setInterval(syncSpotify, 3000)
  }
})

const currentTrack = reactive({
  title: 'Aguardando Spotify...',
  artist: '',
  album: '',
  year: '',
  coverUrl: '/mirage.webp',
  durationMs: 0,
  progressMs: 0,
  isPlaying: false
})

const colors = reactive({ primary: '#111', secondary: '#333', tertiary: '#222' })
const isImageLoaded = ref(false)
let pollInterval: ReturnType<typeof setInterval> | null = null

watch(() => currentTrack.coverUrl, (newUrl) => {
  if (!newUrl) return
  isImageLoaded.value = false
  extractPaletteFromCover(newUrl, (extracted) => {
    colors.primary = extracted.primary
    colors.secondary = extracted.secondary
    colors.tertiary = extracted.tertiary
    isImageLoaded.value = true
  })
}, { immediate: true })

async function syncSpotify() {
  try {
    const state = await getPlaybackState()
    if (!state || !state.item) return

    currentTrack.title = state.item.name
    currentTrack.artist = state.item.artists.map((a: any) => a.name).join(', ')
    currentTrack.album = state.item.album.name
    currentTrack.year = state.item.album.release_date.substring(0, 4)
    
    const newCover = state.item.album.images[0]?.url
    if (currentTrack.coverUrl !== newCover) {
      currentTrack.coverUrl = newCover
    }

    currentTrack.durationMs = state.item.duration_ms
    currentTrack.progressMs = state.progress_ms
    currentTrack.isPlaying = state.is_playing
  } catch (e) {
    console.error("Erro ao ler Spotify. O Token expirou?", e)
  }
}


onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval)
})

async function handlePlay() {
  currentTrack.isPlaying = true
  await play()
  setTimeout(syncSpotify, 500) 
}

async function handlePause() {
  currentTrack.isPlaying = false
  await pause()
  setTimeout(syncSpotify, 500)
}

async function handleSeek(percent: number) {
  const targetMs = (percent / 100) * currentTrack.durationMs
  currentTrack.progressMs = targetMs
  await seek(targetMs)
  setTimeout(syncSpotify, 500)
}

async function handleForward() {
  await nextTrack()
  setTimeout(syncSpotify, 500)
}

async function handleBackward() {
  await previousTrack()
  setTimeout(syncSpotify, 500)
}
</script>

<template>
 <main
    class="relative flex h-screen w-screen flex-col items-center overflow-hidden transition-colors duration-1000 pt-[max(1.5rem,13vh)]"
    :style="{ 
      '--c1': colors.primary, 
      '--c2': colors.secondary, 
      '--c3': colors.tertiary, 
      '--player-size': 'min(650px, calc((100vw - 32px) / 1.6923), calc(100vh - 270px))',
      backgroundColor: colors.primary 
    }"
  >
    <div class="blob blob-1" />
    <div class="blob blob-2" />
    <div class="blob blob-3" />


    <!--LOGIN PAGE-->
    <div v-if="!isAuthenticated" class="relative z-20 flex flex-col items-center gap-6 bg-black/40 p-10 rounded-3xl backdrop-blur-md border border-white/10 my-auto">
      <h1 class="text-3xl font-bold text-white tracking-tight">Spin on Vinyl</h1>
      <p class="text-white/70 text-center max-w-sm">Connect your Spotify account to view your songs on a vinyl.</p>
      
      <button 
        @click="loginWithSpotify"
        class="bg-[#1DB954] text-black font-bold px-8 py-4 rounded-full hover:scale-105 transition-transform flex items-center gap-2 cursor-pointer"
      >
        Connect to Spotify
      </button>
    </div>

    <!--Player (shows if authenticated)-->
    <template v-else>
      <button @click="logout" class="absolute top-3 right-6 z-50 text-white/50 hover:text-white text-sm cursor-pointer">
        Log-out
      </button>

      <div class="relative z-20 flex items-center justify-center">

        <img 
        :src="currentTrack.coverUrl" 
        class="relative z-10 w-(--player-size) h-(--player-size) transition-opacity duration-1000 shadow-2xl rounded object-cover shrink-0"
        :style="{ marginRight: 'calc(var(--player-size) * -0.3077)' }"
        :class="isImageLoaded ? 'opacity-100' : 'opacity-0'"
        >
        
        <VinylPlayer 
        :title="currentTrack.title"
        :artist="currentTrack.artist"
        :album="currentTrack.album"
        :year="currentTrack.year"
        :primary-color="colors.primary" 
        :secondary-color="colors.secondary" 
        :is-playing="currentTrack.isPlaying"
        :progress-ms="currentTrack.progressMs"
        :duration-ms="currentTrack.durationMs"
        @play="handlePlay"
        @pause="handlePause"
        @seek="handleSeek"
        @forward="handleForward"
        @backward="handleBackward"
        />
      </div>
    </template>
  </main>
</template>

<style scoped>
.blob {
  position: absolute;
  border-radius: 50%;
  mix-blend-mode: color-dodge;
  filter: blur(60px);
  opacity: 0.75;
  will-change: transform, border-radius;
}

.blob-1 { width: 55%; height: 60%; background: var(--c2); top: -10%;  left: -10%;  animation: blob1 15s ease-in-out infinite; }
.blob-2 { width: 60%; height: 55%; background: var(--c3); bottom: -15%; right: -15%; animation: blob2 17s ease-in-out infinite; }
.blob-3 { width: 40%; height: 45%; background: var(--c1); top: 30%;   left: 30%;   animation: blob3 19s ease-in-out infinite; }

@keyframes blob1 {
  0%,100% { transform: translate(0%,0%)     scale(1);    border-radius: 60% 40% 70% 30% / 50% 60% 40% 50%; }
  25%     { transform: translate(55%,20%)   scale(1.1);  border-radius: 40% 60% 30% 70% / 60% 40% 70% 30%; }
  50%     { transform: translate(30%,60%)   scale(0.9);  border-radius: 70% 30% 50% 50% / 30% 70% 40% 60%; }
  75%     { transform: translate(-10%,35%)  scale(1.05); border-radius: 50% 50% 40% 60% / 40% 60% 50% 50%; }
}

@keyframes blob2 {
  0%,100% { transform: translate(0%,0%)     scale(1);    border-radius: 40% 60% 50% 50% / 60% 40% 55% 45%; }
  30%     { transform: translate(-40%,30%)  scale(1.15); border-radius: 60% 40% 30% 70% / 40% 70% 30% 60%; }
  60%     { transform: translate(-20%,-40%) scale(0.85); border-radius: 30% 70% 60% 40% / 50% 30% 70% 50%; }
  80%     { transform: translate(20%,-20%)  scale(1.1);  border-radius: 55% 45% 40% 60% / 35% 65% 50% 50%; }
}

@keyframes blob3 {
  0%,100% { transform: translate(0%,0%)    scale(1);    border-radius: 50% 50% 60% 40% / 40% 60% 50% 50%; }
  20%     { transform: translate(30%,-50%) scale(1.2);  border-radius: 70% 30% 40% 60% / 60% 40% 60% 40%; }
  55%     { transform: translate(-30%,-20%)scale(0.8);  border-radius: 35% 65% 55% 45% / 65% 35% 45% 55%; }
  80%     { transform: translate(10%,40%)  scale(1.1);  border-radius: 60% 40% 35% 65% / 45% 55% 60% 40%; }
}

@media (prefers-reduced-motion: reduce) {
  .blob { animation: none; }
}
</style>