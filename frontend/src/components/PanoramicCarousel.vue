<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import type { MediaItem } from '@/services/spotify'

interface Props {
  items: MediaItem[]
  modelValue?: number
  currentlyPlayingUri?: string
  isPlaying?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: 0,
  currentlyPlayingUri: '',
  isPlaying: false
})

const emit = defineEmits<{
  (e: 'update:modelValue', index: number): void
  (e: 'play', item: MediaItem): void
  (e: 'select', item: MediaItem): void
  (e: 'open', item: MediaItem): void
}>()

const activeItem = computed(() => {
  if (props.items.length === 0) return null
  return props.items[props.modelValue] || props.items[0] || null
})

function prev() {
  if (props.modelValue > 0) {
    emit('update:modelValue', props.modelValue - 1)
  }
}

function next() {
  if (props.modelValue < props.items.length - 1) {
    emit('update:modelValue', props.modelValue + 1)
  }
}

let pointerStartX = 0
let hasDragged = false
let isPointerDown = false

function onPointerDown(e: PointerEvent) {
  pointerStartX = e.clientX
  hasDragged = false
  isPointerDown = true
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!isPointerDown) return
  if (Math.abs(e.clientX - pointerStartX) > 8) {
    hasDragged = true
  }
}

function onPointerUp(e: PointerEvent) {
  if (!isPointerDown) return
  isPointerDown = false
  try {
    ;(e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId)
  } catch {}

  const diff = e.clientX - pointerStartX
  if (Math.abs(diff) > 40) {
    diff < 0 ? next() : prev()
  }
}

function handleCardClick(index: number, item: MediaItem) {
  if (hasDragged) return
  if (index !== props.modelValue) {
    emit('update:modelValue', index)
  } else {
    emit('open', item)
  }
}

let wheelLocked = false
function onWheel(e: WheelEvent) {
  if (wheelLocked || props.items.length <= 1) return
  const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (Math.abs(delta) < 20) return

  wheelLocked = true
  delta > 0 ? next() : prev()
  setTimeout(() => { wheelLocked = false }, 200)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    next()
  } else if ((e.key === ' ' || e.key === 'Enter') && activeItem.value) {
    e.preventDefault()
    emit('play', activeItem.value)
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function getItemStyle(index: number) {
  const delta = index - props.modelValue
  const abs = Math.abs(delta)
  if (abs > 4) return { display: 'none' }

  const angle = Math.max(-40, Math.min(40, delta * 26))
  return {
    transform: `translateX(${delta * 220}px) translateZ(${-abs * 70}px) rotateY(${-angle}deg) scale(${Math.max(0.7, 1 - abs * 0.08)})`,
    opacity: Math.max(0.2, 1 - abs * 0.18),
    zIndex: 100 - abs
  }
}

function isItemPlaying(item: MediaItem): boolean {
  return props.isPlaying && props.currentlyPlayingUri === item.uri
}
</script>

<template>
  <div 
    class="relative w-full select-none outline-none overflow-hidden flex flex-col items-center justify-center py-6"
    tabindex="0"
    @wheel.prevent="onWheel"
  >
    <div 
      class="carousel-stage relative w-full h-100 md:h-115 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <button
        v-if="modelValue > 0"
        @click.stop="prev"
        class="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-40 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 hover:border-white/40 text-white flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
        aria-label="Previous album"
      >
        <svg class="w-5 h-5 fill-current -translate-x-0.5" viewBox="0 0 24 24">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
      </button>

      <button
        v-if="modelValue < items.length - 1"
        @click.stop="next"
        class="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-40 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 hover:border-white/40 text-white flex items-center justify-center backdrop-blur-xl shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
        aria-label="Next album"
      >
        <svg class="w-5 h-5 fill-current translate-x-0.5" viewBox="0 0 24 24">
          <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
        </svg>
      </button>

      <div class="carousel-3d-world relative w-full h-full flex items-center justify-center">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          class="carousel-item-wrapper absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform cursor-pointer"
          :style="getItemStyle(index)"
          @click="handleCardClick(index, item)"
        >
          <div 
            class="album-card group relative w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80 transition-shadow duration-500"
            :class="{
              'is-center': index === modelValue,
              'is-playing': isItemPlaying(item)
            }"
          >
            <div 
              class="vinyl-disc absolute right-0 top-1/2 -translate-y-1/2 w-[92%] h-[92%] rounded-full bg-[#0a0a0a] shadow-2xl pointer-events-none transition-transform duration-700 ease-out flex items-center justify-center overflow-hidden"
              :class="{
                'vinyl-peek-center': index === modelValue,
                'vinyl-spin-active': isItemPlaying(item)
              }"
            >
              <div class="vinyl-groove-rings absolute inset-0 rounded-full" />
              <div class="vinyl-light-sheen absolute inset-0 rounded-full" />
              <div class="relative w-[34%] h-[34%] rounded-full shadow-inner overflow-hidden border-2 border-black/40 flex items-center justify-center">
                <img :src="item.coverUrl" class="w-full h-full object-cover filter brightness-90" alt="" />
                <div class="absolute w-3.5 h-3.5 rounded-full bg-[#121212] border border-white/30 shadow-inner" />
              </div>
            </div>

            <div class="relative z-10 w-full h-full rounded-md md:rounded-lg overflow-hidden shadow-2xl border border-white/10 bg-[#161616] group-hover:border-white/30 transition-all duration-300">
              <img 
                :src="item.coverUrl" 
                :alt="item.title" 
                loading="lazy"
                class="w-full h-full object-cover select-none pointer-events-none transition-transform duration-700 group-hover:scale-105"
              />
              <div class="sleeve-gloss absolute inset-0 pointer-events-none" />
              <div class="sleeve-spine-shadow absolute left-0 top-0 bottom-0 w-3 pointer-events-none" />

              <div 
                class="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                :class="{ 'opacity-100': isItemPlaying(item) }"
              >
                <div 
                  @click.stop="emit('play', item)"
                  class="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-2xl flex items-center justify-center transform transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                >
                  <div v-if="isItemPlaying(item)" class="flex items-end gap-1 h-5">
                    <span class="eq-bar eq-1 w-1 bg-black rounded-full" />
                    <span class="eq-bar eq-2 w-1 bg-black rounded-full" />
                    <span class="eq-bar eq-3 w-1 bg-black rounded-full" />
                  </div>
                  <svg v-else class="w-7 h-7 ml-1 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              <div class="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] md:text-xs font-medium text-white/80">
                <span v-if="item.year">{{ item.year }}</span>
                <span v-else-if="item.tracksCount">{{ item.tracksCount }} tracks</span>
                <span v-else>{{ item.type.toUpperCase() }}</span>
              </div>
            </div>

            <div class="floor-reflection-container absolute top-full left-0 right-0 h-24 overflow-hidden pointer-events-none opacity-40">
              <img 
                :src="item.coverUrl" 
                class="w-full h-full object-cover transform -scale-y-100 filter blur-[1px]" 
                alt=""
              />
              <div class="reflection-mask absolute inset-0" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div 
      v-if="activeItem"
      class="relative z-30 mt-6 md:mt-8 flex flex-col items-center text-center px-4 max-w-xl transition-all duration-500 ease-out"
    >
      <h2 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight line-clamp-1 drop-shadow-md">
        {{ activeItem.title }}
      </h2>

      <p class="text-white/70 text-sm sm:text-base font-medium mt-1 drop-shadow">
        {{ activeItem.subtitle }}
      </p>

      <div class="flex items-center gap-2 mt-2 text-xs font-semibold text-white/50">
        <span class="uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10">
          {{ activeItem.type }}
        </span>
        <span v-if="activeItem.year">• {{ activeItem.year }}</span>
        <span v-if="activeItem.tracksCount">• {{ activeItem.tracksCount }} tracks</span>
      </div>

      <div class="flex items-center gap-3 mt-4">
        <button 
          @click="emit('open', activeItem)"
          class="flex items-center gap-2 bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold px-5 py-2.5 rounded-full shadow-lg shadow-green-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer text-sm"
        >
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <span>View Songs</span>
        </button>

        <button 
          @click="emit('play', activeItem)"
          class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2.5 rounded-full border border-white/15 backdrop-blur-md hover:scale-105 active:scale-95 transition-all cursor-pointer text-sm"
        >
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span>{{ isItemPlaying(activeItem) ? 'Playing' : 'Play' }}</span>
        </button>

        <router-link 
          to="/"
          class="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium px-4 py-2.5 rounded-full border border-white/15 backdrop-blur-md hover:scale-105 active:scale-95 transition-all text-sm cursor-pointer"
        >
          <span>Turntable</span>
        </router-link>
      </div>

      <div class="flex items-center gap-1.5 mt-5">
        <button
          v-for="(_, idx) in Math.min(items.length, 15)"
          :key="idx"
          @click="emit('update:modelValue', idx)"
          class="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
          :class="modelValue === idx ? 'w-6 bg-[#1DB954]' : 'w-1.5 bg-white/25 hover:bg-white/50'"
          :aria-label="`Go to item ${idx + 1}`"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.carousel-stage {
  perspective: 1100px;
  perspective-origin: 50% 48%;
  touch-action: pan-y;
}

.carousel-3d-world {
  transform-style: preserve-3d;
}

.carousel-item-wrapper {
  transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
}

.album-card:hover .vinyl-disc,
.album-card.is-center .vinyl-disc {
  transform: translateY(-50%) translateX(36%);
}

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

.vinyl-light-sheen {
  background: conic-gradient(
    from 45deg,
    rgba(255, 255, 255, 0.12) 0deg,
    transparent 60deg,
    rgba(255, 255, 255, 0.12) 180deg,
    transparent 240deg,
    rgba(255, 255, 255, 0.12) 360deg
  );
  mix-blend-mode: screen;
}

.vinyl-spin-active {
  animation: vinyl-spin 8s linear infinite;
}

@keyframes vinyl-spin {
  from { transform: translateY(-50%) translateX(36%) rotate(0deg); }
  to { transform: translateY(-50%) translateX(36%) rotate(360deg); }
}

.sleeve-gloss {
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.22) 0%,
    rgba(255, 255, 255, 0.05) 30%,
    transparent 50%,
    rgba(0, 0, 0, 0.4) 100%
  );
}

.sleeve-spine-shadow {
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.6) 0%,
    rgba(0, 0, 0, 0.2) 60%,
    transparent 100%
  );
}

.floor-reflection-container {
  mask-image: linear-gradient(to bottom, black 0%, transparent 80%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 80%);
}

.reflection-mask {
  background: linear-gradient(to bottom, transparent 0%, rgba(10, 10, 12, 0.9) 100%);
}

.eq-bar {
  animation: eq-bounce 1s ease-in-out infinite alternate;
}
.eq-1 { height: 16px; animation-delay: 0.1s; }
.eq-2 { height: 22px; animation-delay: 0.3s; }
.eq-3 { height: 12px; animation-delay: 0.2s; }

@keyframes eq-bounce {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}
</style>
