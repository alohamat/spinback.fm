<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'

interface VinylPlayerProps {
  title?: string; artist?: string; album?: string; year?: string
  primaryColor?: string; secondaryColor?: string
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
}
const props = withDefaults(defineProps<VinylPlayerProps>(), {
  title: '', artist: '', album: '', year: '',
  primaryColor: '#8e44ad', secondaryColor: '#e67e22',
  isPlaying: false, progressMs: 0, durationMs: 0
})

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'seek', percent: number): void
  (e: 'forward'): void
  (e: 'backward'): void
}>()

function togglePlay() {
  if (props.isPlaying) {
    emit('pause')
  } else {
    emit('play')
  }
}

function formatTime(ms: number) {
  if (!ms) return '00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const displayCurrentTime = computed(() => formatTime(props.progressMs))
const displayDuration = computed(() => formatTime(props.durationMs))

const TIP_X   = 0.15
const TIP_Y   = 0.98
const PIVOT_X = 0.72
const PIVOT_Y = 0.15
const DISC_R  = 0.705 
const LABEL_R = 0.17 
const DEBUG   = false

const CENTER_X = 0.6 
const CENTER_Y = 0.50

const START_ANGLE = -53
const SWING_RANGE = 36

const containerRef = ref<HTMLDivElement | null>(null)
const needleRef    = ref<HTMLImageElement | null>(null)
const isDragging   = ref(false)
const isReady      = ref(false)
const isTouching   = ref(false)

const vinylAngle = ref(0)
let rAF: number | null = null
let lastTime: DOMHighResTimeStamp | null = null

function tick(t: DOMHighResTimeStamp) {
  if (lastTime !== null) {
    const dt = t - lastTime
    
    if (props.isPlaying && !isDragging.value) {
      vinylAngle.value = (vinylAngle.value + (360 / 3000) * dt) % 360
      
      if (props.durationMs > 0 && isTouching.value) {
         const progressPercentDelta = dt / props.durationMs
         angle.value += SWING_RANGE * progressPercentDelta
      }
      
      checkCollision()
    }
  }

  lastTime = t
  rAF = requestAnimationFrame(tick)
}

function startSpinning() {
  if (rAF !== null) return
  lastTime = null
  rAF = requestAnimationFrame(tick)
}

function stopSpinning() {
  if (rAF !== null) cancelAnimationFrame(rAF)
  rAF = null
  lastTime = null
}

const trackProgress = ref(0)

function updateProgress() {
  if (!containerRef.value) return
  if (!isTouching.value) {
    trackProgress.value = 0
    return
  }

  const tip = calcTip()
  const w = containerRef.value.offsetWidth
  const h = containerRef.value.offsetHeight
  
  const centerX = w * CENTER_X
  const centerY = h * CENTER_Y
  const dist = Math.hypot(tip.x - centerX, tip.y - centerY)
  
  const outerR = (w / 2) * DISC_R
  const innerR = (w / 2) * LABEL_R
  const p = (outerR - dist) / (outerR - innerR)
  
  trackProgress.value = Math.min(100, Math.max(0, p * 100))
}

const needleSize = ref({ w: 0, h: 0 })
const pivotPos   = ref({ x: 0, y: 0 })
const angle      = ref(0)

const naturalTipAngle = computed(() => {
  const { w, h } = needleSize.value
  if (!w || !h) return 0
  return Math.atan2((TIP_Y - PIVOT_Y) * h, (TIP_X - PIVOT_X) * w) * (180 / Math.PI)
})

const needleLeft = computed(() => pivotPos.value.x - PIVOT_X * needleSize.value.w)
const needleTop  = computed(() => pivotPos.value.y - PIVOT_Y * needleSize.value.h)

function calcTip() {
  const { w, h } = needleSize.value
  const θ   = angle.value * (Math.PI / 180)
  const dx0 = (TIP_X - PIVOT_X) * w
  const dy0 = (TIP_Y - PIVOT_Y) * h
  return {
    x: pivotPos.value.x + dx0 * Math.cos(θ) - dy0 * Math.sin(θ),
    y: pivotPos.value.y + dx0 * Math.sin(θ) + dy0 * Math.cos(θ),
  }
}

function getRestAngle() {
  if (!needleRef.value || !containerRef.value) return 0
  const cw = containerRef.value.offsetWidth
  const ch = containerRef.value.offsetHeight
  const nw = needleRef.value.clientWidth
  const nh = needleRef.value.clientHeight
  if (!nw || !nh) return 0

  pivotPos.value = { x: cw * 0.8, y: ch * 0 }
  const restX = cw * 1.25
  const restY = ch * 0.85
  return (
    Math.atan2(restY - pivotPos.value.y, restX - pivotPos.value.x) * (180 / Math.PI) -
    naturalTipAngle.value
  )
}

function getAngleForProgress(progressMs: number, durationMs: number): number {
  if (durationMs <= 0) return START_ANGLE
  const percent = Math.min(1, Math.max(0, progressMs / durationMs))
  return START_ANGLE + SWING_RANGE * percent
}

function syncNeedleWithPlayback() {
  if (!isReady.value || isDragging.value) return

  if (props.isPlaying) {
    angle.value = getAngleForProgress(props.progressMs, props.durationMs)
    checkCollision()
  } else {
    if (!isTouching.value) {
      angle.value = getRestAngle()
      checkCollision()
    }
  }
}

watch(() => props.isPlaying, (newIsPlaying) => {
  if (isDragging.value || !isReady.value) return
  if (newIsPlaying) {
    syncNeedleWithPlayback()
  } else {
    angle.value = getRestAngle()
    checkCollision()
  }
})

watch(() => props.progressMs, (newMs) => {
  if (isDragging.value || props.durationMs <= 0 || !containerRef.value || !isReady.value) return

  if (!isTouching.value && props.isPlaying) {
    syncNeedleWithPlayback()
    return
  }

  if (isTouching.value) {
    const currentLocalMs = (trackProgress.value / 100) * props.durationMs
    if (Math.abs(newMs - currentLocalMs) > 1500) {
      angle.value = getAngleForProgress(newMs, props.durationMs)
      checkCollision()
    }
  }
})

function checkCollision() {
  if (!containerRef.value) return
  const tip  = calcTip()
  const w    = containerRef.value.offsetWidth
  const h    = containerRef.value.offsetHeight
  
  const centerX = w * CENTER_X
  const centerY = h * CENTER_Y
  const dist = Math.hypot(tip.x - centerX, tip.y - centerY)
  
  const outerR = (w / 2) * DISC_R
  const innerR = (w / 2) * LABEL_R

  const now = dist <= outerR && dist > innerR

  if (now && !isTouching.value) {
    isTouching.value = true
    startSpinning()
  } else if (!now && isTouching.value) {
    isTouching.value = false
    stopSpinning()
  }

  updateProgress()
}

function onMouseDown(e: MouseEvent) { isDragging.value = true; e.preventDefault() }

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value || !containerRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const mouseAngleDeg =
    Math.atan2(e.clientY - rect.top - pivotPos.value.y, e.clientX - rect.left - pivotPos.value.x)
    * (180 / Math.PI)
  angle.value = mouseAngleDeg - naturalTipAngle.value
  checkCollision()
}

function onMouseUp() { 
  if (!isDragging.value) return
  isDragging.value = false 
  if (isTouching.value) {
    emit('seek', trackProgress.value) 
    emit('play')
  } else {
    angle.value = getRestAngle()
    checkCollision()
    emit('pause')
  }
}

function initNeedle() {
  if (!needleRef.value || !containerRef.value) return
  const cw = containerRef.value.offsetWidth
  const ch = containerRef.value.offsetHeight
  const nw = needleRef.value.clientWidth
  const nh = needleRef.value.clientHeight
  if (!nw || !nh) return

  needleSize.value = { w: nw, h: nh }
  pivotPos.value   = { x: cw * 0.8, y: ch * 0 }

  angle.value = getRestAngle()
  isReady.value = true

  syncNeedleWithPlayback()
}

onMounted(() => {
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  nextTick(initNeedle)
})
onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
  stopSpinning()
})
</script>

<template>
  <div class="flex flex-col items-center gap-4">

    <div ref="containerRef" class="relative w-[min(75vw,650px)] aspect-square">

      <div class="absolute inset-0" :style="{ transform: `rotate(${vinylAngle}deg)` }">
        <img src="/vinyl.webp" alt="Vinyl" class="w-full h-full object-contain" />

        <div
          class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34%] aspect-square rounded-full flex flex-col items-center justify-center text-white text-center shadow-[inset_0_0_30px_rgba(0,0,0,0.45)]"
          :style="{ background: `radial-gradient(circle at 30% 20%, ${secondaryColor}, transparent 60%), linear-gradient(135deg, ${primaryColor}, #111)` }"
        >
          <span class="text-[8px] sm:text-[10px] tracking-[0.2em] uppercase opacity-70 mb-2">Tocando agora</span>
          <h1 class="text-sm sm:text-xl md:text-2xl font-medium leading-tight">{{ title }}</h1>
          <h2 class="mt-1 text-[10px] sm:text-sm opacity-90">{{ artist }}</h2>
          <p class="text-[8px] sm:text-[10px] opacity-60">{{ album }} · {{ year }}</p>
          <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-neutral-900 shadow-[inset_0_1px_3px_rgba(255,255,255,0.25)]" />
        </div>
      </div>

      <!-- needle -->
      <img
        ref="needleRef"
        src="/needle.png"
        alt="Needle"
        draggable="false"
        class="size-75 absolute select-none z-10 transition-opacity duration-200"
        :class="isDragging ? 'cursor-grabbing' : 'cursor-grab'"
        :style="{
          left: `${needleLeft}px`,
          top: `${needleTop}px`,
          transform: `rotate(${angle}deg)`,
          transformOrigin: `${PIVOT_X * 100}% ${PIVOT_Y * 100}%`,
          opacity: isReady ? '1' : '0',
          pointerEvents: isReady ? 'auto' : 'none',
        }"
        @mousedown="onMouseDown"
        @load="initNeedle"
      />

      <!-- Debug -->
      <template v-if="DEBUG">
       
      </template>
    </div>

 <!-- Outside progress bar -->
    <div class="fixed bottom-10 left-1/2 -translate-x-1/2 w-[min(85vw,650px)] z-40 flex flex-col gap-1.5 px-4 pointer-events-auto">
      <div class="flex justify-between text-xs text-white/60">
        <span>{{ displayCurrentTime }}</span>
        <span>{{ displayDuration }}</span>
      </div>
      <div class="h-1.5 rounded-full bg-white/15 overflow-hidden">
        <div
          class="h-full rounded-full"
          :style="{
            width: `${trackProgress}%`,
            background: `linear-gradient(90deg, ${secondaryColor}, ${primaryColor})`,
            transition: isTouching ? 'none' : 'width 0.4s ease',
          }"
        />
      </div>
      <div class="flex justify-center mt-3">
        <div class="flex items-center justify-center gap-4 px-5 py-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl shadow-black/40 pointer-events-auto">
          <!-- Backward Button -->
          <button
            @click="emit('backward')"
            class="group relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 text-white/80 hover:text-white cursor-pointer"
            :style="{ boxShadow: `0 4px 15px ${primaryColor}33` }"
            title="Anterior"
            type="button"
          >
            <svg class="w-4 h-4 fill-current transition-transform group-hover:-translate-x-0.5" viewBox="0 0 24 24">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>

          <!-- Play / Pause Button -->
          <button
            @click="togglePlay"
            class="group relative flex items-center justify-center w-12 h-12 rounded-full border border-white/40 shadow-xl transition-all duration-300 hover:scale-110 active:scale-95 text-white overflow-hidden cursor-pointer"
            :style="{
              background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              boxShadow: `0 6px 20px -2px ${secondaryColor}66`
            }"
            :title="isPlaying ? 'Pausar' : 'Tocar'"
            type="button"
          >
            <span class="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <svg v-if="!isPlaying" class="w-6 h-6 fill-current translate-x-0.5 relative z-10" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else class="w-6 h-6 fill-current relative z-10" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>

          <!-- Forward Button -->
          <button
            @click="emit('forward')"
            class="group relative flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 border border-white/20 transition-all duration-300 hover:scale-110 active:scale-95 text-white/80 hover:text-white cursor-pointer"
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
