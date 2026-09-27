<script setup lang="ts">
import type { RecentlyPlayedItem } from '@/services/spotify'

const props = defineProps<{
  tracks: RecentlyPlayedItem[]
  currentTrackUri?: string
  isPlaying?: boolean
}>()

const emit = defineEmits<{
  (e: 'play', track: RecentlyPlayedItem): void
}>()

function formatDuration(ms: number): string {
  if (!ms) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatPlayedTime(isoString: string): string {
  try {
    const playedDate = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - playedDate.getTime()
    
    if (diffMs < 0 || isNaN(diffMs)) return 'Just now'
    
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) {
      const timeStr = playedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      return `Yesterday ${timeStr}`
    }
    if (diffDays < 7) return `${diffDays}d ago`
    
    return playedDate.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return 'Recently'
  }
}

function isCurrent(track: RecentlyPlayedItem): boolean {
  return Boolean(props.currentTrackUri && props.currentTrackUri === track.uri)
}
</script>

<template>
  <div class="recent-tracks-vertical-list flex flex-col w-full rounded-2xl bg-white/3 border border-white/10 backdrop-blur-xl divide-y overflow-hidden shadow-xl">
    <div 
      v-for="(track, index) in tracks" 
      :key="track.id || index"
      class="track-row group relative flex items-center justify-between px-3 sm:px-5 py-3 hover:bg-white/[0.07] transition-all cursor-pointer"
      :class="{ 'bg-white/6 border-l-2 border-[#1DB954]': isCurrent(track) }"
      @click="emit('play', track)"
    >
      <!-- Left side: Timestamp + Cover + Title & Artist -->
      <div class="flex items-center gap-3 sm:gap-4 min-w-0">
        <!-- Relative Playback Timestamp -->
        <div class="w-14 sm:w-16 shrink-0 text-left">
          <span class="text-[11px] font-mono text-white/40 group-hover:text-white/60 transition-colors">
            {{ formatPlayedTime(track.playedAt) }}
          </span>
        </div>

        <!-- Album Cover Thumbnail with Play Action -->
        <div class="relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg overflow-hidden shrink-0 bg-black/40 border border-white/10 shadow-md">
          <img 
            :src="track.coverUrl" 
            :alt="track.trackName" 
            loading="lazy"
            class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          <!-- Overlay play button / active animated equalizer -->
          <div 
            class="absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity"
            :class="isCurrent(track) && isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
          >
            <template v-if="isCurrent(track) && isPlaying">
              <div class="flex items-end gap-0.5 h-3">
                <span class="w-0.5 bg-[#1DB954] h-full animate-[pulse_0.6s_ease-in-out_infinite]" />
                <span class="w-0.5 bg-[#1DB954] h-2 animate-[pulse_0.4s_ease-in-out_infinite_0.2s]" />
                <span class="w-0.5 bg-[#1DB954] h-full animate-[pulse_0.5s_ease-in-out_infinite_0.1s]" />
              </div>
            </template>
            <template v-else>
              <svg class="w-4 h-4 fill-white ml-0.5" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </template>
          </div>
        </div>

        <!-- Track Title & Artist -->
        <div class="flex flex-col min-w-0">
          <span 
            class="font-medium text-xs sm:text-sm text-white truncate group-hover:text-white/90 transition-colors flex items-center gap-1.5"
            :class="{ 'text-[#1DB954] font-semibold': isCurrent(track) }"
          >
            {{ track.trackName }}
            <span v-if="isCurrent(track) && isPlaying" class="inline-flex w-1.5 h-1.5 rounded-full bg-[#1DB954] animate-ping" />
          </span>
          <span class="text-[11px] sm:text-xs text-white/50 truncate">
            {{ track.artists }}
          </span>
        </div>
      </div>

      <!-- Right side: Album Name (Desktop) + Duration + Play Action -->
      <div class="flex items-center gap-4 sm:gap-6 shrink-0 pl-2">
        <span class="hidden md:inline-block text-xs text-white/40 truncate max-w-45 text-right font-light">
          {{ track.albumName }}
        </span>

        <span class="text-xs font-mono text-white/40 group-hover:text-white/70 transition-colors">
          {{ formatDuration(track.durationMs) }}
        </span>

        <!-- Quick Play Button -->
        <button
          type="button"
          class="w-7 h-7 rounded-full bg-white/10 hover:bg-[#1DB954] text-white hover:text-black flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer shadow"
          :title="`Play ${track.trackName}`"
          @click.stop="emit('play', track)"
        >
          <svg class="w-3.5 h-3.5 fill-current ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
