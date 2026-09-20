<script setup lang="ts">
import VinylPlayer from '@/components/VinylPlayer.vue'
import { getPaletteSync } from 'colorthief'
import type { Color } from 'colorthief'
import { reactive } from 'vue'

const colors = reactive({ primary: '', secondary: '', tertiary: '' })

function colorDistance(a: Color, b: Color): number {
  const { r: r1, g: g1, b: b1 } = a.rgb()
  const { r: r2, g: g2, b: b2 } = b.rgb()
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

function pickDistinctColors(palette: Color[], count = 3): Color[] {
  const picked: Color[] = [palette[0]!]
  while (picked.length < count) {
    const best = palette
      .filter(c => !picked.includes(c))
      .reduce((a, b) =>
        Math.min(...picked.map(p => colorDistance(p, b))) >
        Math.min(...picked.map(p => colorDistance(p, a))) ? b : a
      )
    picked.push(best)
  }
  return picked
}

const imagem = new Image()
imagem.src = '/mirage.webp'
imagem.onload = () => {
  const raw = getPaletteSync(imagem, { colorCount: 8 })
  if (!raw) return
  const [c1, c2, c3] = pickDistinctColors(raw)
  colors.primary   = c1?.hex() ?? ''
  colors.secondary = c2?.hex() ?? ''
  colors.tertiary  = c3?.hex() ?? ''
}
</script>

<template>
  <main
    class="relative flex h-screen w-screen items-center justify-center overflow-hidden"
    :style="{ '--c1': colors.primary, '--c2': colors.secondary, '--c3': colors.tertiary, backgroundColor: colors.primary }"
  >
    <div class="blob blob-1" />
    <div class="blob blob-2" />
    <div class="blob blob-3" />

    <img :src="imagem.src" class="relative z-10 w-[min(75vw,650px)] -mx-50">
    <VinylPlayer :primary-color="colors.primary" :secondary-color="colors.secondary" />
  </main>
</template>

<style scoped>
.blob {
  position: absolute;
  border-radius: 50%;
  mix-blend-mode: color-dodge;
  filter: blur(60px);
  opacity: 0.75;
  will-change: transform, border-radius;
}

.blob-1 { width: 55%; height: 60%; background: var(--c2); top: -10%;  left: -10%;  animation: blob1 15s ease-in-out infinite; }
.blob-2 { width: 60%; height: 55%; background: var(--c3); bottom: -15%; right: -15%; animation: blob2 17s ease-in-out infinite; }
.blob-3 { width: 40%; height: 45%; background: var(--c1); top: 30%;   left: 30%;   animation: blob3 19s ease-in-out infinite; }

@keyframes blob1 {
  0%,100% { transform: translate(0%,0%)     scale(1);    border-radius: 60% 40% 70% 30% / 50% 60% 40% 50%; }
  25%     { transform: translate(55%,20%)   scale(1.1);  border-radius: 40% 60% 30% 70% / 60% 40% 70% 30%; }
  50%     { transform: translate(30%,60%)   scale(0.9);  border-radius: 70% 30% 50% 50% / 30% 70% 40% 60%; }
  75%     { transform: translate(-10%,35%)  scale(1.05); border-radius: 50% 50% 40% 60% / 40% 60% 50% 50%; }
}

@keyframes blob2 {
  0%,100% { transform: translate(0%,0%)     scale(1);    border-radius: 40% 60% 50% 50% / 60% 40% 55% 45%; }
  30%     { transform: translate(-40%,30%)  scale(1.15); border-radius: 60% 40% 30% 70% / 40% 70% 30% 60%; }
  60%     { transform: translate(-20%,-40%) scale(0.85); border-radius: 30% 70% 60% 40% / 50% 30% 70% 50%; }
  80%     { transform: translate(20%,-20%)  scale(1.1);  border-radius: 55% 45% 40% 60% / 35% 65% 50% 50%; }
}

@keyframes blob3 {
  0%,100% { transform: translate(0%,0%)    scale(1);    border-radius: 50% 50% 60% 40% / 40% 60% 50% 50%; }
  20%     { transform: translate(30%,-50%) scale(1.2);  border-radius: 70% 30% 40% 60% / 60% 40% 60% 40%; }
  55%     { transform: translate(-30%,-20%)scale(0.8);  border-radius: 35% 65% 55% 45% / 65% 35% 45% 55%; }
  80%     { transform: translate(10%,40%)  scale(1.1);  border-radius: 60% 40% 35% 65% / 45% 55% 60% 40%; }
}

@media (prefers-reduced-motion: reduce) {
  .blob { animation: none; }
}
</style>