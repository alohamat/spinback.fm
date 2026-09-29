<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatTime } from '@/utils/formatTime'

interface VinylPlayerProps {
  title?: string
  artist?: string
  album?: string
  year?: string
  primaryColor?: string
  secondaryColor?: string
  isPlaying: boolean
  progressMs: number
  durationMs: number
}

const props = withDefaults(defineProps<VinylPlayerProps>(), {
  title: '',
  artist: '',
  album: '',
  year: '',
  primaryColor: '#8e44ad',
  secondaryColor: '#e67e22',
  isPlaying: false,
  progressMs: 0,
  durationMs: 0
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'seek', percent: number): void
  (e: 'forward'): void
  (e: 'backward'): void
}>()

const containerRef = ref<HTMLElement | null>(null)
const isDragging = ref(false)
const dragAngle = ref(-62)
const dragPercent = ref(0)

const progressPercent = computed(() => {
  if (props.durationMs <= 0) return 0
  return Math.min(100, Math.max(0, (props.progressMs / props.durationMs) * 100))
})

const needleAngle = computed(() => {
  if (!props.isPlaying) return -62
  return -50 + (progressPercent.value / 100) * 34
})

const effectivePercent = computed(() => isDragging.value ? dragPercent.value : progressPercent.value)
const effectiveAngle = computed(() => isDragging.value ? dragAngle.value : needleAngle.value)

const displayProgressMs = computed(() => {
  if (isDragging.value && props.durationMs > 0) {
    return (dragPercent.value / 100) * props.durationMs
  }
  return props.progressMs
})

function updateNeedleFromPointer(e: PointerEvent) {
  if (!containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const pivotX = rect.left + rect.width * 0.8
  const pivotY = rect.top
  const angleDeg = Math.atan2(e.clientY - pivotY, e.clientX - pivotX) * (180 / Math.PI)
  const angle = angleDeg - 124.5

  const clamped = Math.max(-62, Math.min(-16, angle))
  dragAngle.value = clamped

  if (clamped <= -52) {
    dragPercent.value = 0
  } else {
    dragPercent.value = Math.min(100, Math.max(0, ((clamped - (-50)) / 34) * 100))
  }
}

function onNeedlePointerDown(e: PointerEvent) {
  isDragging.value = true
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
  updateNeedleFromPointer(e)
}

function onNeedlePointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  updateNeedleFromPointer(e)
}

function onNeedlePointerUp(e: PointerEvent) {
  if (!isDragging.value) return
  isDragging.value = false
  try {
    ;(e.currentTarget as HTMLElement)?.releasePointerCapture?.(e.pointerId)
  } catch {}

  if (dragAngle.value < -54) {
    emit('pause')
  } else {
    emit('seek', dragPercent.value)
    emit('play')
  }
}

function togglePlay() {
  if (props.isPlaying) {
    emit('pause')
  } else {
    emit('play')
  }
}

function handleProgressBarClick(e: MouseEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const percent = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100))
  emit('seek', percent)
}
</script>

<template>
  <div class="flex flex-col items-center gap-4">
    <div ref="containerRef" class="relative w-(--player-size,min(75vw,650px)) aspect-square shrink-0">
      <div 
        class="absolute inset-0 cursor-pointer"
        :class="{ 'animate-vinyl-spin': isPlaying }"
        @click="togglePlay"
      >
        <img src="/vinyl.webp" alt="Vinyl" class="w-full h-full object-contain pointer-events-none select-none" />

        <div
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34%] aspect-square rounded-full flex flex-col items-center justify-center text-white text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.45)]"
          :style="{ background: `radial-gradient(circle at 30% 20%, ${secondaryColor}, transparent 60%), linear-gradient(135deg, ${primaryColor}, #111)` }"
        >
          <span class="text-[8px] sm:text-[10px] tracking-[0.2em] uppercase opacity-70 mb-2">Playing now</span>
          <h1 class="text-sm sm:text-xl md:text-2xl font-medium leading-tight line-clamp-2 px-2">{{ title }}</h1>
          <h2 class="mt-1 text-[10px] sm:text-sm opacity-90 truncate max-w-[85%]">{{ artist }}</h2>
          <p class="text-[8px] sm:text-[10px] opacity-60">{{ album }} · {{ year }}</p>
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-neutral-900 shadow-[inset_0_1px_3px_rgba(255,255,255,0.25)]" />
        </div>
      </div>

      <img
        src="/needle.png"
        alt="Needle"
        draggable="false"
        class="w-[calc(var(--player-size,650px)*0.4615)] h-[calc(var(--player-size,650px)*0.4615)] absolute select-none z-10 touch-none transition-transform"
        :class="isDragging ? 'cursor-grabbing' : 'cursor-grab hover:brightness-110'"
        :style="{
          left: '46.77%',
          top: '-6.92%',
          transformOrigin: '72% 15%',
          transform: `rotate(${effectiveAngle}deg)`,
          transition: isDragging ? 'none' : 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)'
        }"
        @pointerdown="onNeedlePointerDown"
        @pointermove="onNeedlePointerMove"
        @pointerup="onNeedlePointerUp"
        @pointercancel="onNeedlePointerUp"
      />
    </div>

    <div class="fixed bottom-4 sm:bottom-10 left-1/2 -translate-x-1/2 w-[min(92vw,650px)] z-40 flex flex-col gap-1.5 px-3 sm:px-4 pointer-events-auto">
      <div class="flex justify-between text-xs text-white/60 font-mono">
        <span>{{ formatTime(displayProgressMs) }}</span>
        <span>{{ formatTime(durationMs) }}</span>
      </div>

      <div 
        class="h-2 rounded-full bg-white/15 overflow-hidden cursor-pointer py-0.5 group"
        @click="handleProgressBarClick"
      >
        <div
          class="h-full rounded-full"
          :class="isDragging ? '' : 'transition-all duration-300'"
          :style="{
            width: `${effectivePercent}%`,
            background: `linear-gradient(90deg, ${secondaryColor}, ${primaryColor})`
          }"
        />
      </div>

      <div class="flex justify-center mt-2 sm:mt-3">
        <div class="flex items-center justify-center gap-3 sm:gap-4 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/40 pointer-events-auto">
          <button
            @click="emit('backward')"
            class="group relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 text-white/80 hover:text-white cursor-pointer"
            :style="{ boxShadow: `0 4px 15px ${primaryColor}33` }"
            title="Anterior"
            type="button"
          >
            <svg class="w-4 h-4 fill-current transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <button
            @click="togglePlay"
            class="group relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-white/40 shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 text-white overflow-hidden cursor-pointer"
            :style="{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              boxShadow: `0 6px 20px -2px ${secondaryColor}66`
            }"
            :title="isPlaying ? 'Pausar' : 'Tocar'"
            type="button"
          >
            <span class="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <svg v-if="!isPlaying" class="w-5 h-5 sm:w-6 sm:h-6 fill-current translate-x-0.5 relative z-10" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else class="w-5 h-5 sm:w-6 sm:h-6 fill-current relative z-10" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>

          <button
            @click="emit('forward')"
            class="group relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 text-white/80 hover:text-white cursor-pointer"
            :style="{ boxShadow: `0 4px 15px ${primaryColor}33` }"
            title="Próxima"
            type="button"
          >
            <svg class="w-4 h-4 fill-current transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24">
              <path d="M16 6h2v12h-2zm-10.5 0l8.5 6-8.5 6z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
