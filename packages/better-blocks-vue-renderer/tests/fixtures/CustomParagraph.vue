<template>
  <!-- `style` is not declared as a prop, so Vue applies it to this root element
       on its own - which is exactly what a paragraph override wants. -->
  <div data-testid="custom-p"><slot /></div>
</template>
