<script setup lang="ts">
import VinylPlayer from '@/components/VinylPlayer.vue';
import { getPaletteSync, type Color  } from 'colorthief';
import { reactive, ref } from 'vue';


// este é um exemplo. o back deve entregar dessa forma
const imagem = new Image()
imagem.src = '/mirage.webp'
const palette = ref<Color[] | null>(null)
const VinylProps = reactive({
  title: 'Lady Fantasy',
  artist: 'Camel',
  album: 'Mirage',
  year: '1974',
  primaryColor: '',
  secondaryColor: '',
  tertiaryColor: '',
})


imagem.onload = () => {
  palette.value = getPaletteSync(imagem, { colorCount: 3 })
  if (palette.value) {
    VinylProps.primaryColor = palette.value[0]?.hex() ?? ''
    VinylProps.secondaryColor = palette.value[1]?.hex() ?? ''
    VinylProps.tertiaryColor = palette.value[2]?.hex() ?? ''
  }
  console.log(palette.value)
}



</script>
<template>
    <main class="flex h-screen w-screen justify-center items-center" :style="{ backgroundColor: VinylProps.primaryColor }">
        <img src="/mirage.webp" class="w-[min(75vw,650px)] -mx-50 z-100">
        <VinylPlayer/>
    </main>
</template>