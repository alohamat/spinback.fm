<script setup lang="ts">
import type { TopArtistItem } from '@/services/spotify'

defineProps<{
  artist: TopArtistItem
  rank: number
}>()

const emit = defineEmits<{
  (e: 'select', artist: TopArtistItem): void
}>()

const formatFollowers = (n?: number) =>
  n ? `${new Intl.NumberFormat('en', { notation: 'compact' }).format(n)} fans` : ''
</script>

<template>
  <div 
    class="relative flex flex-col items-center rounded-2xl bg-white/4 border border-white/15 p-4 sm:p-5 backdrop-blur-xl shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:border-white/35 hover:shadow-[0_25px_50px_rgba(0,0,0,0.85)] group cursor-pointer overflow-hidden text-center"
    @click="emit('select', artist)"
  >
    <div class="absolute inset-0 bg-linear-to-tr from-transparent via-white/5 to-transparent pointer-events-none opacity-40 group-hover:opacity-80 transition-opacity duration-700" />

    <div class="absolute top-1/4 w-36 h-36 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 bg-[#1DB954]" />

    <div class="absolute top-3 left-3 z-10 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md">
      <span class="text-[10px] font-mono font-bold tracking-wider text-white/40">#</span>
      <span class="text-xs font-mono font-bold text-white tracking-wider">{{ String(rank).padStart(2, '0') }}</span>
    </div>

    <div class="relative w-32 h-32 sm:w-36 sm:h-36 mt-4 mb-4 rounded-full p-1.5 bg-linear-to-b from-white/20 via-white/5 to-white/15 border border-white/20 shadow-2xl group-hover:border-white/40 group-hover:shadow-[0_10px_30px_rgba(0,0,0,0.7)] transition-all duration-500">
      <div class="w-full h-full rounded-full overflow-hidden relative bg-black/60">
        <img 
          :src="artist.imageUrl" 
          :alt="artist.name"
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div class="absolute inset-0 rounded-full shadow-[inset_0_0_16px_rgba(0,0,0,0.6)] pointer-events-none" />
      </div>
    </div>

    <div class="relative z-10 flex flex-col items-center gap-1.5 w-full mt-auto">
      <h4 class="font-bold text-base text-white tracking-tight leading-snug line-clamp-1 group-hover:text-white/90 transition-colors" :title="artist.name">
        {{ artist.name }}
      </h4>

      <div class="mt-1 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/30 text-[#1DB954] text-xs font-mono font-bold tracking-wide">
        <span>{{ artist.popularity }}% popularity</span>
      </div>

      <div v-if="artist.genres?.length" class="flex flex-wrap items-center justify-center gap-1 mt-1">
        <span 
          v-for="genre in artist.genres.slice(0, 2)" 
          :key="genre"
          class="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-white/70 border border-white/10 capitalize truncate max-w-30"
        >
          {{ genre }}
        </span>
      </div>

      <p v-if="artist.followers" class="text-[11px] text-white/40 font-mono mt-0.5">
        {{ formatFollowers(artist.followers) }}
      </p>
    </div>
  </div>
</template>
