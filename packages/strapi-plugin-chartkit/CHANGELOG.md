## 0.1.6 (2026-08-17)

### 🧱 Updated Dependencies

- Updated @qkix/chartkit-editor to 0.1.5
- Updated @qkix/chartkit-core to 0.2.3

## 0.1.5 (2026-08-17)

This was a version bump only for @qkix/strapi-plugin-chartkit to align it with other projects, there were no code changes.

## 0.1.4 (2026-08-17)

### 🧱 Updated Dependencies

- Updated @qkix/chartkit-editor to 0.1.4
- Updated @qkix/chartkit-core to 0.2.2

## 0.1.3 (2026-08-16)

### 🩹 Fixes

- **better-blocks:** bound the oEmbed cache and cover the network path ([#132](https://github.com/qkix/strapi-plugins/pull/132))

### 🧱 Updated Dependencies

- Updated @qkix/chartkit-editor to 0.1.3
- Updated @qkix/chartkit-core to 0.2.1

### ❤️ Thank You

- kkukielka

## 0.1.2 (2026-08-16)

### 📖 Documentation

- **chartkit:** rewrite the README around real screenshots ([#128](https://github.com/qkix/strapi-plugins/pull/128))

  No code changes. Published so the package page carries the new README: the
  field in the edit view, the editor, a spreadsheet paste, a chart block in a
  document, and every chart type as `renderChart` actually draws it.

## 0.1.1 (2026-08-16)

### 📖 Documentation

- **chartkit:** show the one-line block registration ([#126](https://github.com/qkix/strapi-plugins/pull/126))

  No change to this plugin's code. Registering the chart block in a Better
  Blocks document is now `registerBlock(chartBlockDefinition())` rather than
  the file of Slate wiring the README used to point at.

### 🧱 Updated Dependencies

- Updated @qkix/chartkit-editor to 0.1.2

### ❤️ Thank You

- kkukielka

## 0.1.0 (2026-08-16)

### 🚀 Features

- **chartkit:** add the standalone Strapi custom field ([#124](https://github.com/qkix/strapi-plugins/pull/124))

  A chart as a Strapi field of its own, so Chartkit works in a project with no
  Better Blocks in it. Stores a `ChartSpec` — the same object the renderers
  take. Migrates older specs on read, and refuses to overwrite a value it cannot
  recognise.

### 🧱 Updated Dependencies

- Updated @qkix/chartkit-editor to 0.1.1

### ❤️ Thank You

- kkukielka
