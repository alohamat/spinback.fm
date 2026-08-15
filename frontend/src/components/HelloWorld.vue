```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getPaletteSync } from 'colorthief'

const mirage = '/mirage.webp'
const closetotheedge = '/closetotheedge.webp'

const background = ref(
  'linear-gradient(135deg, #111827, #000000)'
)

onMounted(() => {
  const img = new Image()
  img.src = closetotheedge

  img.onload = () => {
    const palette = getPaletteSync(img, {
      colorCount: 3
    })

    if (!palette) {
      return
    }

    const colors = palette.map(color => color.css())

    background.value = `
      radial-gradient(
        circle at 20% 20%,
        ${colors[0]},
        transparent 50%
      ),
      radial-gradient(
        circle at 80% 30%,
        ${colors[1]},
        transparent 50%
      ),
      linear-gradient(
        135deg,
        ${colors[2]},
        #000
      )
    `
  }
})
</script>

<template>
  <main
    class="min-h-screen transition-all duration-1000"
    :style="{ background }"
  >
    <h1>Hello, world!</h1>

    <img
      :src="closetotheedge"
      alt="Mirage"
      class="animate-vinyl-spin"
    >
  </main>
</template>
```
