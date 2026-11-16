<template>
 <button role="button" :tabindex="disabled ? -1 : 0" :aria-disabled="disabled" :disabled="disabled" @click="activate" @keydown="handleKey"><slot /></button>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
const emit = defineEmits<{ click: [event: Event] }>()
function activate(event: Event) { if (!props.disabled) emit('click', event) }
function handleKey(event: KeyboardEvent) {
 if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event) }
}
</script>
