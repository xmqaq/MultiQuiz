<script setup lang="ts">
import type { AppTab } from '@/stores/ui';

defineProps<{ name: AppTab }>();
</script>

<template>
  <svg class="tab-icon-svg" viewBox="0 0 24 24" aria-hidden="true">
    <g v-if="name === 'subjects'">
      <path d="M5 5.5A3 3 0 0 1 8 4h11v14H8a3 3 0 0 0-3 1.5z" />
      <path d="M5 5.5v14" />
      <path d="M9 8h6" />
      <path d="M9 11h5" />
    </g>
    <g v-else-if="name === 'import'">
      <path d="M12 4v10" />
      <path d="m8 8 4-4 4 4" />
      <path d="M5 14v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-3" />
    </g>
    <g v-else-if="name === 'browse'">
      <circle cx="10.5" cy="10.5" r="5.5" />
      <path d="m15 15 4.5 4.5" />
      <path d="M8 10.5h5" />
    </g>
    <g v-else-if="name === 'exam'">
      <path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      <path d="M9 9h6" />
      <path d="M9 13h3" />
      <path d="m14 15 1.5 1.5L19 13" />
    </g>
    <g v-else-if="name === 'wrong'">
      <path d="M12 4 3.5 19h17z" />
      <path d="M12 9v4" />
      <path d="M12 16h.01" />
    </g>
    <g v-else-if="name === 'history'">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l3 2" />
      <path d="M4 12H2" />
    </g>
    <g v-else>
      <path d="M5 19V5" />
      <path d="M5 19h14" />
      <path d="M8 16v-5" />
      <path d="M12 16V8" />
      <path d="M16 16v-9" />
    </g>
  </svg>
</template>

<style scoped>
.tab-icon-svg {
  display: block;
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
}
</style>
