## 0.1.2 (2026-08-16)

This was a version bump only for @qkix/strapi-plugin-chartkit to align it with other projects, there were no code changes.

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
