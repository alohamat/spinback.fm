<script setup lang="ts">
import { ref } from 'vue'

interface VinylPlayerProps {
  title?: string
  artist?: string
  album?: string
  year?: string
  primaryColor?: string
  secondaryColor?: string
}

withDefaults(defineProps<VinylPlayerProps>(), {
  title: 'Lady Fantasy',
  artist: 'Camel',
  album: 'Mirage',
  year: '1974',
  primaryColor: '#8e44ad',
  secondaryColor: '#e67e22',
  tertiaryColor: '',
})

const isPlaying = ref(true)
const currentTime = ref('02:37')
const duration = ref('12:11')
const progress = ref(25)
</script>

<template>
    <div class="relative w-[min(75vw,650px)] aspect-square" :class="{ 'animate-vinyl-spin': isPlaying }">
      <img src="/vinyl.webp" alt="Vinyl" class=" inset-0  object-contain" />

      <div
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34%] aspect-square rounded-full flex flex-col items-center justify-center text-white text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.45)]"
        :style="{
          background: `
            radial-gradient(circle at 30% 20%, ${secondaryColor}, transparent 60%),
            linear-gradient(135deg, ${primaryColor}, #111)
          `
        }"
      >
        <span class="text-[8px] sm:text-[10px] tracking-[0.2em] uppercase opacity-70 mb-2">
          Tocando agora
        </span>
        
        <h1 class="text-sm sm:text-xl md:text-2xl font-medium leading-tight">
          {{ title }}
        </h1>
        
        <h2 class="mt-1 text-[10px] sm:text-sm opacity-90">
          {{ artist }}
        </h2>
        
        <p class="text-[8px] sm:text-[10px] opacity-60">
          {{ album }} · {{ year }}
        </p>

        <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-neutral-900 shadow-[inset_0_1px_3px_rgba(255,255,255,0.25)]" />

        <div class="absolute bottom-[13%] left-[15%] right-[15%] flex justify-between text-[7px] sm:text-[9px] opacity-70">
          <span>{{ currentTime }}</span>
          <span>{{ duration }}</span>
        </div>

        <div class="absolute bottom-[9%] left-[15%] right-[15%] h-[2px] rounded-full bg-white/15">
          <div
            class="h-full rounded-full"
            :style="{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${secondaryColor}, ${primaryColor})`
            }"
          />
        </div>
      </div>
    </div>
</template>

<style>
@keyframes vinyl-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-vinyl-spin {
  animation: vinyl-spin 3s linear infinite;
}
</style>