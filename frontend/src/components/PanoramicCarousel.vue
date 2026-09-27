<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
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

// Active index (interpolated for smooth dragging)
const currentIndex = ref(props.modelValue)
const targetIndex = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  targetIndex.value = Math.max(0, Math.min(props.items.length - 1, val))
})

watch(() => props.items, (newItems) => {
  if (targetIndex.value >= newItems.length) {
    targetIndex.value = Math.max(0, newItems.length - 1)
  }
})

// Current item
const activeItem = computed(() => {
  if (props.items.length === 0) return null
  const idx = Math.round(targetIndex.value)
  return props.items[idx] || props.items[0] || null
})

// Drag / Swipe handling
const stageRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartIndex = ref(0)
let animationFrameId: number | null = null

function springAnimation() {
  if (!isDragging.value) {
    const diff = targetIndex.value - currentIndex.value
    if (Math.abs(diff) > 0.001) {
      currentIndex.value += diff * 0.18
      animationFrameId = requestAnimationFrame(springAnimation)
    } else {
      currentIndex.value = targetIndex.value
      animationFrameId = null
    }
  } else {
    animationFrameId = requestAnimationFrame(springAnimation)
  }
}

function startSpring() {
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(springAnimation)
  }
}

function onPointerDown(e: PointerEvent) {
  if (props.items.length <= 1) return
  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartIndex.value = currentIndex.value
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
  startSpring()
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  const deltaX = e.clientX - dragStartX.value
  // Spacing in pixels per item
  const cardSpacing = 220
  const indexDelta = -deltaX / cardSpacing
  const nextIdx = dragStartIndex.value + indexDelta
  // Apply resistance at edges
  if (nextIdx < 0) {
    currentIndex.value = nextIdx * 0.3
  } else if (nextIdx > props.items.length - 1) {
    const overflow = nextIdx - (props.items.length - 1)
    currentIndex.value = props.items.length - 1 + overflow * 0.3
  } else {
    currentIndex.value = nextIdx
  }
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value) return
  isDragging.value = false
  try {
    ;(e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId)
  } catch {}

  const rounded = Math.round(currentIndex.value)
  const clamped = Math.max(0, Math.min(props.items.length - 1, rounded))
  targetIndex.value = clamped
  emit('update:modelValue', clamped)
  startSpring()
}

// Click handling: center and open
function handleItemClick(index: number, item: MediaItem) {
  if (isDragging.value) return

  targetIndex.value = index
  emit('update:modelValue', index)
  startSpring()

  // Emit open to show songs inside the album/playlist
  emit('open', item)
}

function prev() {
  if (targetIndex.value > 0) {
    targetIndex.value--
    emit('update:modelValue', targetIndex.value)
    startSpring()
  }
}

function next() {
  if (targetIndex.value < props.items.length - 1) {
    targetIndex.value++
    emit('update:modelValue', targetIndex.value)
    startSpring()
  }
}

// Wheel support (scroll through albums)
let wheelTimeout: ReturnType<typeof setTimeout> | null = null
function onWheel(e: WheelEvent) {
  if (props.items.length <= 1) return
  e.preventDefault()
  
  const rawDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
  if (Math.abs(rawDelta) < 15) return

  if (wheelTimeout) return
  wheelTimeout = setTimeout(() => {
    wheelTimeout = null
  }, 180)

  if (rawDelta > 0) {
    next()
  } else {
    prev()
  }
}

// Keyboard navigation
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    next()
  } else if (e.key === ' ' || e.key === 'Enter') {
    if (activeItem.value) {
      e.preventDefault()
      emit('play', activeItem.value)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  startSpring()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})

// Calculate 3D transformation for an item relative to currentIndex
function getItemStyle(index: number) {
  const delta = index - currentIndex.value
  const absDelta = Math.abs(delta)

  // Beyond 5 items away, hide to optimize rendering
  if (absDelta > 5.5) {
    return { display: 'none' }
  }

  // Base dimensions
  const spacing = 220
  const extraCenterGap = 40
  const sign = Math.sign(delta)

  // Horizontal translation along line
  const x = delta * spacing + (absDelta > 0 ? sign * extraCenterGap : 0)

  // Panoramic inward curve angle (Y-axis)
  // Cards on left rotate rightward (+deg), cards on right rotate leftward (-deg)
  const clampedAngle = Math.max(-42, Math.min(42, delta * 30))
  const rotateY = -clampedAngle

  // Z-depth: active item is lifted forward, distant items recede
  const z = -Math.min(360, absDelta * 75) + (1 - Math.min(absDelta, 1)) * 60

  // Scale: active item is 1.06, distant items scale down gracefully
  const scale = Math.max(0.68, 1 - absDelta * 0.08)

  // Opacity
  const opacity = Math.max(0.2, 1 - absDelta * 0.16)

  // Stacking order
  const zIndex = Math.round(500 - absDelta * 20)

  return {
    transform: `translateX(${x}px) translateZ(${z}px) rotateY(${rotateY}deg) scale(${scale})`,
    opacity,
    zIndex,
    transformOrigin: '50% 50%'
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
    @wheel="onWheel"
  >
    <!-- Panoramic 3D Stage Container -->
    <div 
      ref="stageRef"
      class="carousel-stage relative w-full h-100 md:h-115 flex items-center justify-center cursor-grab"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >

      <!-- Carousel 3D World -->
      <div class="carousel-3d-world relative w-full h-full flex items-center justify-center">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          class="carousel-item-wrapper absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 will-change-transform"
          :style="getItemStyle(index)"
          @click="handleItemClick(index, item)"
        >
          <!-- Vinyl Album Component -->
          <div 
            class="album-card group relative w-60 h-60 sm:w-72 sm:h-72 md:w-80 md:h-80 transition-shadow duration-500 cursor-pointer"
            :class="{
              'is-center': Math.abs(currentIndex - index) < 0.35,
              'is-playing': isItemPlaying(item)
            }"
          >
            <!-- PEELING VINYL DISC (Slides out on active or hover) -->
            <div 
              class="vinyl-disc absolute right-0 top-1/2 -translate-y-1/2 w-[92%] h-[92%] rounded-full bg-[#0a0a0a] shadow-2xl pointer-events-none transition-transform duration-700 ease-out flex items-center justify-center overflow-hidden"
              :class="{
                'vinyl-peek-center': Math.abs(currentIndex - index) < 0.35,
                'vinyl-spin-active': isItemPlaying(item)
              }"
            >
              <!-- Vinyl Grooves -->
              <div class="vinyl-groove-rings absolute inset-0 rounded-full" />
              <!-- Vinyl Sheen / Reflection -->
              <div class="vinyl-light-sheen absolute inset-0 rounded-full" />
              <!-- Center Label -->
              <div class="vinyl-center-label relative w-[34%] h-[34%] rounded-full shadow-inner overflow-hidden border-2 border-black/40 flex items-center justify-center">
                <img :src="item.coverUrl" class="w-full h-full object-cover filter brightness-90" alt="" />
                <!-- Spindle hole -->
                <div class="absolute w-3.5 h-3.5 rounded-full bg-[#121212] border border-white/30 shadow-inner" />
              </div>
            </div>

            <!-- ALBUM SLEEVE COVER -->
            <div class="album-sleeve relative z-10 w-full h-full rounded-md md:rounded-lg overflow-hidden shadow-2xl border border-white/10 bg-[#161616] group-hover:border-white/30 transition-all duration-300">
              <img 
                :src="item.coverUrl" 
                :alt="item.title"
                loading="lazy"
                class="w-full h-full object-cover select-none pointer-events-none transition-transform duration-700 group-hover:scale-105"
              />

              <!-- Sleeve Gloss Sheen -->
              <div class="sleeve-gloss absolute inset-0 pointer-events-none" />

              <!-- Spine Shadow (giving 3D cardboard thickness) -->
              <div class="sleeve-spine-shadow absolute left-0 top-0 bottom-0 w-3 pointer-events-none" />

              <!-- Play Overlay / Indicator -->
              <div 
                class="play-overlay absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
                :class="{ 'opacity-100': isItemPlaying(item) }"
              >
                <!-- Large Play / Playing Button -->
                <div 
                  @click.stop="emit('play', item)"
                  class="w-14 h-14 md:w-16 md:md:h-16 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-2xl flex items-center justify-center transform transition-transform duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                >
                  <!-- Playing Equalizer Animation -->
                  <div v-if="isItemPlaying(item)" class="flex items-end gap-1 h-5">
                    <span class="eq-bar eq-1 w-1 bg-black rounded-full" />
                    <span class="eq-bar eq-2 w-1 bg-black rounded-full" />
                    <span class="eq-bar eq-3 w-1 bg-black rounded-full" />
                  </div>
                  <!-- Play Icon -->
                  <svg v-else class="w-7 h-7 ml-1 fill-current" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              <!-- Badge (Year or Track count) -->
              <div class="absolute top-2.5 right-2.5 z-20 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[10px] md:text-xs font-medium text-white/80">
                <span v-if="item.year">{{ item.year }}</span>
                <span v-else-if="item.tracksCount">{{ item.tracksCount }} tracks</span>
                <span v-else>{{ item.type.toUpperCase() }}</span>
              </div>
            </div>

            <!-- Floor Reflection underneath cover -->
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

    <!-- Active Album Meta Info & Controls -->
    <div 
      v-if="activeItem"
      class="relative z-30 mt-6 md:mt-8 flex flex-col items-center text-center px-4 max-w-xl transition-all duration-500 ease-out"
    >
      <!-- Title -->
      <h2 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight line-clamp-1 drop-shadow-md">
        {{ activeItem.title }}
      </h2>

      <!-- Subtitle / Artist -->
      <p class="text-white/70 text-sm sm:text-base font-medium mt-1 drop-shadow">
        {{ activeItem.subtitle }}
      </p>

      <!-- Badges -->
      <div class="flex items-center gap-2 mt-2 text-xs font-semibold text-white/50">
        <span class="uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-white/10 border border-white/10">
          {{ activeItem.type }}
        </span>
        <span v-if="activeItem.year">• {{ activeItem.year }}</span>
        <span v-if="activeItem.tracksCount">• {{ activeItem.tracksCount }} tracks</span>
      </div>

      <!-- Action Buttons -->
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

      <!-- Scrubber Dots Indicator -->
      <div class="flex items-center gap-1.5 mt-5">
        <button
          v-for="(_, idx) in Math.min(items.length, 15)"
          :key="idx"
          @click="targetIndex = idx; emit('update:modelValue', idx); startSpring();"
          class="h-1.5 rounded-full transition-all duration-300 cursor-pointer"
          :class="Math.round(currentIndex) === idx ? 'w-6 bg-[#1DB954]' : 'w-1.5 bg-white/25 hover:bg-white/50'"
          :aria-label="`Go to item ${idx + 1}`"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 3D Panoramic Stage */
.carousel-stage {
  perspective: 1100px;
  perspective-origin: 50% 48%;
  touch-action: pan-y;
}

.carousel-3d-world {
  transform-style: preserve-3d;
}

.carousel-item-wrapper {
  transition: transform 0.08s linear, opacity 0.2s ease-out;
}

/* BORDER BLUR EFFECT */
.carousel-blur-edge {
  position: absolute;
  top: 0;
  bottom: 0;
  width: clamp(80px, 18vw, 240px);
  z-index: 45;
}

.edge-left {
  left: 0;
}

.edge-right {
  right: 0;
}

/* Multi-layer blur: backdrop blur mask + gradient darkening */
.edge-left .blur-backdrop {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  mask-image: linear-gradient(to right, black 25%, transparent 100%);
  -webkit-mask-image: linear-gradient(to right, black 25%, transparent 100%);
}

.edge-left .vignette-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(to right, rgba(10, 10, 12, 0.85) 0%, rgba(10, 10, 12, 0.4) 40%, transparent 100%);
}

.edge-right .blur-backdrop {
  position: absolute;
  inset: 0;
  backdrop-filter: blur(18px) saturate(160%);
  -webkit-backdrop-filter: blur(18px) saturate(160%);
  mask-image: linear-gradient(to left, black 25%, transparent 100%);
  -webkit-mask-image: linear-gradient(to left, black 25%, transparent 100%);
}

.edge-right .vignette-fade {
  position: absolute;
  inset: 0;
  background: linear-gradient(to left, rgba(10, 10, 12, 0.85) 0%, rgba(10, 10, 12, 0.4) 40%, transparent 100%);
}

/* Vinyl Peeking effect */
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

/* Sleeve Card Sheen */
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

/* Floor Reflection */
.floor-reflection-container {
  mask-image: linear-gradient(to bottom, black 0%, transparent 80%);
  -webkit-mask-image: linear-gradient(to bottom, black 0%, transparent 80%);
}

.reflection-mask {
  background: linear-gradient(to bottom, transparent 0%, rgba(10, 10, 12, 0.9) 100%);
}

/* Equalizer Bars */
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
