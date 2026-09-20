<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

interface VinylPlayerProps {
  title?: string; artist?: string; album?: string; year?: string
  primaryColor?: string; secondaryColor?: string
}
withDefaults(defineProps<VinylPlayerProps>(), {
  title: 'Lady Fantasy', artist: 'Camel',
  album: 'Mirage', year: '1974',
  primaryColor: '#8e44ad', secondaryColor: '#e67e22',
})

const currentTime = ref('02:37')
const duration    = ref('12:11')

// ─── Calibração ─────────────────────────────────────────────────────────
const TIP_X   = 0.15
const TIP_Y   = 0.98
const PIVOT_X = 0.72
const PIVOT_Y = 0.15
const DISC_R  = 0.88   // borda do vinil
const LABEL_R = 0.17   // borda do label central (área não tocável)
const DEBUG   = false
// ────────────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLDivElement | null>(null)
const needleRef    = ref<HTMLImageElement | null>(null)
const isDragging   = ref(false)
const isReady      = ref(false)
const isTouching   = ref(false)

// ─── Rotação via rAF — pausar não reseta o ângulo ───────────────────────
const vinylAngle = ref(0)
let rAF: number | null = null
let lastTime: DOMHighResTimeStamp | null = null

function startSpinning() {
  if (rAF !== null) return
  lastTime = null
  function tick(t: DOMHighResTimeStamp) {
    if (lastTime !== null)
      vinylAngle.value = (vinylAngle.value + (360 / 3000) * (t - lastTime)) % 360
    lastTime = t
    rAF = requestAnimationFrame(tick)
  }
  rAF = requestAnimationFrame(tick)
}

function stopSpinning() {
  if (rAF !== null) cancelAnimationFrame(rAF)
  rAF = null
  lastTime = null
}

// ─── Progresso: distância da ponta ao centro ────────────────────────────
const trackProgress = ref(0)

function updateProgress() {
  if (!containerRef.value || !isTouching.value) return
  const tip = calcTip()
  const w = containerRef.value.offsetWidth
  const dist = Math.hypot(tip.x - w / 2, tip.y - w / 2)
  const outerR = (w / 2) * DISC_R
  const innerR = (w / 2) * LABEL_R
  const p = (outerR - dist) / (outerR - innerR)
  trackProgress.value = Math.min(180, Math.max(0, p * 180))
  console.log(trackProgress.value)
}

// ─── Agulha ─────────────────────────────────────────────────────────────
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

function checkCollision() {
  if (!containerRef.value) return
  const tip  = calcTip()
  const w    = containerRef.value.offsetWidth
  const dist = Math.hypot(tip.x - w / 2, tip.y - w / 2)
  const now  = dist <= (w / 2) * DISC_R

  if (now && !isTouching.value) {
    isTouching.value = true
    startSpinning()
    console.log('🎵 Agulha encostou no disco!')
  } else if (!now && isTouching.value) {
    isTouching.value = false
    stopSpinning()
    console.log('🔇 Saiu do disco')
  }

  updateProgress()
}

// Debug
const debugTip   = computed(() => DEBUG ? calcTip() : null)
const debugPivot = computed(() => DEBUG ? { ...pivotPos.value } : null)

// ─── Drag ────────────────────────────────────────────────────────────────
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

function onMouseUp() { isDragging.value = false }

function initNeedle() {
  if (!needleRef.value || !containerRef.value) return
  const cw = containerRef.value.offsetWidth
  const ch = containerRef.value.offsetHeight
  const nw = needleRef.value.clientWidth
  const nh = needleRef.value.clientHeight
  if (!nw || !nh) return

  needleSize.value = { w: nw, h: nh }
  pivotPos.value   = { x: cw * 1, y: ch * 0 }

  const restX = cw * 1.25
  const restY = ch * 0.85
  angle.value =
    Math.atan2(restY - pivotPos.value.y, restX - pivotPos.value.x) * (180 / Math.PI)
    - naturalTipAngle.value

  isReady.value = true
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

    <!-- Container ESTÁTICO -->
    <div ref="containerRef" class="relative w-[min(75vw,650px)] aspect-square">

      <!-- Vinil girado por rAF -->
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
          <!-- Tempos dentro do label giram com o disco — omita se incomodar -->
          <div class="absolute bottom-[13%] left-[15%] right-[15%] flex justify-between text-[7px] sm:text-[9px] opacity-70">
            <span>{{ currentTime }}</span><span>{{ duration }}</span>
          </div>
          <div class="absolute bottom-[9%] left-[15%] right-[15%] h-[2px] rounded-full bg-white/15">
            <div
              class="h-full rounded-full"
              :style="{ width: `${trackProgress}%`, background: `linear-gradient(90deg, ${secondaryColor}, ${primaryColor})` }"
            />
          </div>
        </div>
      </div>

      <!-- Agulha -->
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
        <div v-if="debugTip"
          class="absolute w-3 h-3 rounded-full bg-red-500 z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          :style="{ left: `${debugTip.x}px`, top: `${debugTip.y}px` }"
        />
        <div v-if="debugPivot"
          class="absolute w-3 h-3 rounded-full bg-blue-500 z-20 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          :style="{ left: `${debugPivot.x}px`, top: `${debugPivot.y}px` }"
        />
      </template>
    </div>

    <!-- ─── Barra de progresso externa ─────────────────────────────────── -->
    <div class="w-[min(75vw,650px)] flex flex-col gap-1.5 px-1">
      <div class="flex justify-between text-xs text-white/60">
        <span>{{ currentTime }}</span>
        <span>{{ duration }}</span>
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
    </div>

  </div>
</template>

<!-- CSS animation removida — rotação agora via rAF -->