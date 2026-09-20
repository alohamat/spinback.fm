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

const isPlaying  = ref(false)
const currentTime = ref('02:37')
const duration   = ref('12:11')
const progress   = ref(25)

// ─── Calibração ─────────────────────────────────────────────────────────
const TIP_X   = 0.15    // ponta da agulha na imagem
const TIP_Y   = 0.98
const PIVOT_X = 0.72    // ← cabeça/pivô na imagem — ajuste com DEBUG = true
const PIVOT_Y = 0.15    //   ponto azul deve ficar PARADO enquanto você arrasta
const DISC_R  = 0.88    // ← fração do raio do container = borda real do disco
const DEBUG   = false   //   vermelho = ponta | azul = pivô
// ────────────────────────────────────────────────────────────────────────

const containerRef = ref<HTMLDivElement | null>(null)
const needleRef    = ref<HTMLImageElement | null>(null)
const isDragging   = ref(false)
const isReady      = ref(false)
const isTouching   = ref(false)

const needleSize = ref({ w: 0, h: 0 })
const pivotPos   = ref({ x: 0, y: 0 })  // posição FIXA no container (px)
const angle      = ref(0)               // rotação CSS em graus

// Direção natural da ponta na imagem sem rotação — calculado automaticamente
const naturalTipAngle = computed(() => {
  const { w, h } = needleSize.value
  if (!w || !h) return 0
  const dx = (TIP_X - PIVOT_X) * w
  const dy = (TIP_Y - PIVOT_Y) * h
  return Math.atan2(dy, dx) * (180 / Math.PI)
})

// Posição top-left da imagem para que PIVOT_X/Y fique em pivotPos
const needleLeft = computed(() => pivotPos.value.x - PIVOT_X * needleSize.value.w)
const needleTop  = computed(() => pivotPos.value.y - PIVOT_Y * needleSize.value.h)

// Ponta em coords do container via matriz de rotação — sem getBoundingClientRect
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

// Colisão: círculo puro, em coords do container
function checkCollision() {
  if (!containerRef.value) return
  const tip  = calcTip()
  const { offsetWidth: w } = containerRef.value
  const dist = Math.hypot(tip.x - w / 2, tip.y - w / 2)  // container é quadrado
  const r    = (w / 2) * DISC_R
  const now  = dist <= r

  if (now && !isTouching.value) {
    isTouching.value = true
    console.log('🎵 Agulha encostou no disco!')
    isPlaying.value = true
  } else if (!now && isTouching.value) {
    isTouching.value = false
    console.log('🔇 Saiu do disco')
    isPlaying.value = false
  }
}

// Debug dots
const debugTip   = computed(() => DEBUG ? calcTip() : null)
const debugPivot = computed(() => DEBUG ? { ...pivotPos.value } : null)

// ─── Drag (rotação em torno do pivô fixo) ────────────────────────────────
function onMouseDown(e: MouseEvent) {
  isDragging.value = true
  e.preventDefault()
}

function onMouseMove(e: MouseEvent) {
  if (!isDragging.value || !containerRef.value) return
  const rect   = containerRef.value.getBoundingClientRect()
  const mx     = e.clientX - rect.left
  const my     = e.clientY - rect.top
  const mouseAngle = Math.atan2(my - pivotPos.value.y, mx - pivotPos.value.x) * (180 / Math.PI)
  // Subtrai o ângulo natural para que a PONTA aponte onde o mouse está
  angle.value = mouseAngle - naturalTipAngle.value
  checkCollision()
}

function onMouseUp() { isDragging.value = false }

// ─── Init ────────────────────────────────────────────────────────────────
function initNeedle() {
  if (!needleRef.value || !containerRef.value) return
  const cw = containerRef.value.offsetWidth
  const ch = containerRef.value.offsetHeight
  const nw = needleRef.value.clientWidth
  const nh = needleRef.value.clientHeight
  if (!nw || !nh) return

  needleSize.value = { w: nw, h: nh }

  // Pivô fixo: acima e à direita do disco — mova se necessário
  pivotPos.value = { x: cw * 0.95, y: ch * -0.05 }

  // Ângulo de repouso: agulha fora do disco, aponta para baixo-direita
  const restX = cw * 1.25
  const restY = ch * 0.85
  angle.value = (
    Math.atan2(restY - pivotPos.value.y, restX - pivotPos.value.x) * (180 / Math.PI)
    - naturalTipAngle.value
  )

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
})
</script>

<template>
  <!-- Container ESTÁTICO: a referência de coords para tudo -->
  <div ref="containerRef" class="relative w-[min(75vw,650px)] aspect-square">

    <!-- Vinil girante separado do container -->
    <div class="absolute inset-0" :class="{ 'animate-vinyl-spin': isPlaying }">
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
        <div class="absolute bottom-[13%] left-[15%] right-[15%] flex justify-between text-[7px] sm:text-[9px] opacity-70">
          <span>{{ currentTime }}</span><span>{{ duration }}</span>
        </div>
        <div class="absolute bottom-[9%] left-[15%] right-[15%] h-[2px] rounded-full bg-white/15">
          <div class="h-full rounded-full" :style="{ width: `${progress}%`, background: `linear-gradient(90deg, ${secondaryColor}, ${primaryColor})` }" />
        </div>
      </div>
    </div>

    <!-- Agulha com pivô fixo e drag rotacional -->
    <img
      ref="needleRef"
      src="/needle.png"
      alt="Needle"
      draggable="false"
      class="size-75  absolute select-none z-10 transition-opacity duration-200"
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

    <!-- Debug: vermelho = ponta | azul = pivô (deve ficar parado) -->
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
</template>

<style>
@keyframes vinyl-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.animate-vinyl-spin { animation: vinyl-spin 3s linear infinite; }
</style>