<script setup lang="ts">
import { computed } from 'vue'
import type { TopAlbumItem } from '@/services/spotify'

const props = defineProps<{
  album: TopAlbumItem
  rank: number
  isPlaying?: boolean
}>()

const emit = defineEmits<{
  (e: 'play', album: TopAlbumItem): void
}>()

const formattedRank = computed(() => {
  return String(props.rank).padStart(2, '0')
})

function handlePlay(e: Event) {
  e.stopPropagation()
  emit('play', props.album)
}
</script>

<template>
  <div 
    class="album-frame relative flex flex-col rounded-2xl bg-white/4 border border-white/15 p-3 sm:p-4 backdrop-blur-xl shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:border-white/35 hover:shadow-[0_25px_50px_rgba(0,0,0,0.85)] group cursor-pointer overflow-hidden"
    @click="handlePlay"
  >
    <!-- Frame Glass Sheen Reflection -->
    <div class="absolute inset-0 bg-linear-to-tr from-transparent via-white/[0.07] to-transparent pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity duration-700" />

    <!-- Top Frame Header (Rank & Spin Status) -->
    <div class="relative z-10 flex items-center justify-between mb-3">
      <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/15 backdrop-blur-md">
        <span class="text-[10px] font-mono font-bold tracking-wider text-white/40">#</span>
        <span class="text-xs font-mono font-bold text-white tracking-widest">{{ formattedRank }}</span>
      </div>

      <div v-if="album.year" class="text-[11px] font-mono text-white/50 px-2 py-0.5 rounded-md bg-white/5 border border-white/10">
        {{ album.year }}
      </div>
    </div>

    <!-- Vinyl Artwork Presentation Box -->
    <div class="relative w-full aspect-square flex items-center justify-center mb-3">
      <!-- Vinyl Disc peeking out on hover -->
      <div 
        class="vinyl-disc absolute right-1 w-[88%] h-[88%] rounded-full bg-[#111] border-2 border-[#1c1c1c] shadow-2xl flex items-center justify-center transition-transform duration-500 ease-out group-hover:translate-x-6 sm:group-hover:translate-x-8"
        :class="{ 'animate-spin-slow': isPlaying }"
      >
        <!-- Vinyl Grooves -->
        <div class="absolute inset-2 rounded-full border border-white/5" />
        <div class="absolute inset-4 rounded-full border border-white/4" />
        <div class="absolute inset-6 rounded-full border border-white/5" />
        <div class="absolute inset-8 rounded-full border border-white/4" />
        <div class="absolute inset-10 rounded-full border border-white/3" />
        
        <!-- Vinyl Center Label -->
        <div class="relative w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#202025] border border-white/20 flex items-center justify-center shadow-inner overflow-hidden">
          <img 
            :src="album.coverUrl" 
            :alt="album.name" 
            class="w-full h-full object-cover opacity-60 scale-125"
          />
          <div class="absolute w-2.5 h-2.5 rounded-full bg-[#0a0a0c] border border-white/30" />
        </div>
      </div>

      <!-- Album Cover Sleeve Frame -->
      <div class="relative z-10 w-full h-full rounded-xl overflow-hidden shadow-2xl border border-white/15 bg-black/40 group-hover:shadow-[0_15px_35px_rgba(0,0,0,0.9)] transition-shadow">
        <img 
          :src="album.coverUrl" 
          :alt="album.name" 
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        <!-- Hover Play Overlay -->
        <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <button 
            type="button"
            class="w-12 h-12 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl shadow-green-500/30 transform scale-75 group-hover:scale-100 transition-all duration-300 cursor-pointer"
            :title="`Play ${album.name}`"
          >
            <svg v-if="!isPlaying" class="w-5 h-5 fill-current ml-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <div v-else class="flex items-center gap-1">
              <span class="w-1 h-4 bg-black animate-pulse" />
              <span class="w-1 h-4 bg-black animate-pulse delay-100" />
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Gallery Exhibition Plaque -->
    <div class="relative z-10 flex flex-col gap-1 mt-auto pt-2 border-t border-white/10">
      <div class="flex items-start justify-between gap-2">
        <h4 class="font-bold text-sm text-white tracking-tight leading-snug line-clamp-1 group-hover:text-white/90 transition-colors" :title="album.name">
          {{ album.name }}
        </h4>
      </div>

      <p class="text-xs text-white/60 line-clamp-1" :title="album.artist">
        {{ album.artist }}
      </p>

      <div class="flex items-center justify-between text-[11px] mt-1.5 pt-1">
        <span class="text-xs font-mono font-bold text-[#1DB954] px-2.5 py-0.5 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/30">
          {{ album.playCount }} spins
        </span>
        <span class="text-white/50 group-hover:text-white flex items-center gap-1 font-sans text-[11px] transition-colors">
          <span>Spin</span>
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vinyl-disc {
  will-change: transform;
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin-slow 12s linear infinite;
}
</style>
