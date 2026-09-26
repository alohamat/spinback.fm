<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { MediaItemDetails, TrackItem } from '@/services/spotify'
import { formatTime, formatTotalDuration } from '@/utils/formatTime'
import { extractPaletteFromCover } from '@/utils/colorPalette'

interface Props {
  show: boolean
  details: MediaItemDetails | null
  isLoading?: boolean
  currentlyPlayingUri?: string
  currentTrackTitle?: string
  isPlaying?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  details: null,
  isLoading: false,
  currentlyPlayingUri: '',
  currentTrackTitle: '',
  isPlaying: false
})

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'play-all', details: MediaItemDetails): void
  (e: 'play-track', track: TrackItem, index: number): void
}>()

const router = useRouter()

// Dynamic Palette extracted from album cover
const colors = reactive({
  primary: '#141418',
  secondary: '#22222a',
  tertiary: '#0c0c0f'
})

watch(() => props.details?.coverUrl, (newUrl) => {
  if (!newUrl) return
  extractPaletteFromCover(newUrl, (extracted) => {
    colors.primary = extracted.primary
    colors.secondary = extracted.secondary
    colors.tertiary = extracted.tertiary
  })
}, { immediate: true })

function onBackdropClick(e: MouseEvent) {
  if (e.target === e.currentTarget) {
    emit('close')
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.show) {
    emit('close')
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

const formattedTotalDuration = computed(() => {
  if (!props.details) return ''
  return formatTotalDuration(props.details.totalDurationMs)
})

function isTrackPlaying(track: TrackItem): boolean {
  if (!props.isPlaying) return false
  if (props.currentlyPlayingUri && props.currentlyPlayingUri === track.uri) return true
  if (props.currentTrackTitle && track.name && props.currentTrackTitle.toLowerCase().trim() === track.name.toLowerCase().trim()) return true
  return false
}

function isMediaPlaying(): boolean {
  if (!props.details || !props.isPlaying) return false
  return props.currentlyPlayingUri === props.details.uri
}

function goToTurntable() {
  emit('close')
  router.push('/')
}
</script>

<template>
  <Teleport to="body">
    <transition name="modal-fade">
      <div 
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/70 backdrop-blur-md select-none"
        @click="onBackdropClick"
        aria-modal="true"
        role="dialog"
      >
        <!-- Minimalist Modal Container infused with Album Palette -->
        <div 
          class="modal-card relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl overflow-hidden text-white my-auto animate-scale-up"
          :style="{
            '--c1': colors.primary,
            '--c2': colors.secondary,
            '--c3': colors.tertiary
          }"
          @click.stop
        >
          <!-- Ambient Fluid Glow Background -->
          <div class="ambient-glow absolute inset-0 pointer-events-none" />

          <!-- Minimalist Top Close Button -->
          <button 
            @click="emit('close')"
            class="absolute top-4 right-4 z-30 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 text-white/50 hover:text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
            aria-label="Close"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <!-- Loading State -->
          <div v-if="isLoading" class="flex flex-col items-center justify-center py-24 gap-3">
            <div class="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            <p class="text-xs text-white/40 tracking-wider">Loading tracks...</p>
          </div>

          <!-- Content when Loaded -->
          <template v-else-if="details">
            <!-- MINIMALIST HERO HEADER -->
            <div class="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 p-6 sm:p-7 border-b border-white/[0.06] shrink-0">
              
              <!-- Clean Album Artwork -->
              <div class="relative w-32 h-32 sm:w-36 sm:h-36 shrink-0 group">
               

                <!-- Clean Sleeve Cover -->
                <div class="relative z-10 w-full h-full rounded-xl overflow-hidden shadow-xl border border-white/10 bg-[#161616]">
                  <img :src="details.coverUrl" :alt="details.title" class="w-full h-full object-cover" />
                  <div class="sleeve-sheen absolute inset-0 pointer-events-none" />
                </div>
              </div>

              <!-- Typography & Clean Metadata -->
              <div class="flex-1 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 pr-6">
                <!-- Eyebrow -->
                <span class="text-[10px] font-semibold tracking-widest uppercase text-white/40">
                  {{ details.type }}{{ details.year ? ` · ${details.year}` : '' }}
                </span>

                <!-- Title -->
                <h2 class="text-xl sm:text-2xl font-bold text-white mt-1 leading-snug tracking-tight line-clamp-2">
                  {{ details.title }}
                </h2>

                <!-- Subtitle / Artist -->
                <p class="text-xs sm:text-sm font-medium text-white/60 mt-0.5">
                  {{ details.subtitle }}
                </p>

                <!-- Clean Metadata: Song count & Album Duration -->
                <p class="text-xs text-white/40 mt-2 font-medium">
                  {{ details.tracksCount }} songs · {{ formattedTotalDuration }}
                </p>

                <!-- Action Buttons -->
                <div class="flex items-center gap-2.5 mt-4">
                  <button 
                    @click="emit('play-all', details)"
                    class="play-button flex items-center gap-2 text-black font-semibold text-xs px-5 py-2 rounded-full shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Play {{ details.type === 'album' ? 'Album' : 'Playlist' }}</span>
                  </button>

                  <button 
                    @click="goToTurntable"
                    class="text-xs font-medium text-white/50 hover:text-white px-3 py-2 rounded-full hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Turntable
                  </button>
                </div>
              </div>
            </div>

            <!-- MINIMALIST SONGS LIST -->
            <div class="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 py-3 custom-scrollbar">
              <div class="divide-y divide-white/[0.04]">
                <div 
                  v-for="(track, index) in details.tracks"
                  :key="track.id"
                  @click="emit('play-track', track, index)"
                  class="track-row group flex items-center justify-between py-2 px-3 rounded-lg transition-colors cursor-pointer"
                  :class="{ 'track-active': isTrackPlaying(track) }"
                >
                  <!-- Track Number / Play Indicator & Title -->
                  <div class="flex items-center gap-3.5 min-w-0 pr-4">
                    <!-- Track Number or Mini Equalizer -->
                    <div class="w-5 flex items-center justify-center shrink-0">
                      <!-- Playing Equalizer Bars -->
                      <div v-if="isTrackPlaying(track)" class="flex items-end gap-0.5 h-3">
                        <span class="eq-mini eq-1 w-0.5 rounded-full" />
                        <span class="eq-mini eq-2 w-0.5 rounded-full" />
                        <span class="eq-mini eq-3 w-0.5 rounded-full" />
                      </div>
                      <!-- Hover Play Icon -->
                      <svg class="w-3 h-3 text-white/90 hidden group-hover:block ml-0.5 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <!-- Number -->
                      <span 
                        v-if="!isTrackPlaying(track)" 
                        class="text-[11px] font-medium text-white/30 group-hover:hidden"
                      >
                        {{ index + 1 }}
                      </span>
                    </div>

                    <!-- Title & Artist -->
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span 
                          class="text-xs sm:text-sm font-medium truncate transition-colors"
                          :class="isTrackPlaying(track) ? 'text-white font-semibold' : 'text-white/80 group-hover:text-white'"
                        >
                          {{ track.name }}
                        </span>
                        <span v-if="track.explicit" class="text-[9px] font-semibold px-1 rounded bg-white/10 text-white/50">
                          E
                        </span>
                      </div>
                      <p v-if="track.artists && (details.type === 'playlist' || track.artists !== details.subtitle)" class="text-[11px] text-white/40 truncate mt-0.5">
                        {{ track.artists }}
                      </p>
                    </div>
                  </div>

                  <!-- Track Duration -->
                  <span class="text-xs font-mono text-white/35 group-hover:text-white/70 shrink-0 tabular-nums">
                    {{ formatTime(track.durationMs) }}
                  </span>
                </div>
              </div>

              <!-- Empty Tracks Fallback -->
              <div v-if="details.tracks.length === 0" class="py-12 text-center text-xs text-white/40 flex flex-col items-center gap-2">
                <p>No songs available to preview for this playlist.</p>
                <button 
                  @click="emit('play-all', details)"
                  class="mt-1 text-xs text-white/70 hover:text-white underline cursor-pointer"
                >
                  Play directly on Spotify
                </button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* Modal card with palette infusion */
.modal-card {
  background: radial-gradient(
    circle at top left,
    color-mix(in srgb, var(--c1) 32%, #111216) 0%,
    color-mix(in srgb, var(--c2) 18%, #090a0d) 50%,
    #08080a 100%
  );
  border: 1px solid color-mix(in srgb, var(--c2) 35%, rgba(255, 255, 255, 0.08));
  box-shadow: 
    0 24px 70px -15px rgba(0, 0, 0, 0.9),
    0 0 60px -20px color-mix(in srgb, var(--c1) 25%, transparent);
}

/* Subtle ambient glow matching palette */
.ambient-glow {
  background: radial-gradient(
    circle at 20% 15%,
    color-mix(in srgb, var(--c2) 20%, transparent) 0%,
    transparent 65%
  );
}

/* Play button tinted by album palette */
.play-button {
  background: color-mix(in srgb, var(--c2) 30%, #f4f4f5);
}
.play-button:hover {
  background: #ffffff;
}

/* Track Row styles */
.track-row:hover {
  background: color-mix(in srgb, var(--c1) 25%, rgba(255, 255, 255, 0.04));
}

.track-active {
  background: color-mix(in srgb, var(--c2) 30%, rgba(255, 255, 255, 0.07));
}

.track-active .eq-mini {
  background: color-mix(in srgb, var(--c2) 50%, #ffffff);
}

/* Vinyl textures */
.vinyl-groove-rings {
  background: repeating-radial-gradient(
    circle at center,
    #0c0c0c 0,
    #141414 1px,
    #0a0a0a 2px,
    #171717 3px,
    #080808 4px
  );
}

.vinyl-spinning {
  animation: vinyl-spin 9s linear infinite;
}

@keyframes vinyl-spin {
  from { transform: translateY(-50%) translateX(12px) rotate(0deg); }
  to { transform: translateY(-50%) translateX(12px) rotate(360deg); }
}

.sleeve-sheen {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.12) 0%,
    transparent 50%,
    rgba(0, 0, 0, 0.3) 100%
  );
}

/* Mini equalizer animation */
.eq-mini {
  animation: eq-bounce 0.8s ease-in-out infinite alternate;
}
.eq-1 { height: 8px; animation-delay: 0.1s; }
.eq-2 { height: 12px; animation-delay: 0.3s; }
.eq-3 { height: 6px; animation-delay: 0.2s; }

@keyframes eq-bounce {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}

/* Animations */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease-out;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@keyframes scaleUp {
  0% { transform: scale(0.96) translateY(8px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

.animate-scale-up {
  animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
</style>
