## 0.1.5 (2026-08-17)

### 🧱 Updated Dependencies

- Updated @qkix/chartkit-core to 0.2.3

## 0.1.4 (2026-08-17)

### 🧱 Updated Dependencies

- Updated @qkix/chartkit-core to 0.2.2

## 0.1.3 (2026-08-16)

### 🧱 Updated Dependencies

- Updated @qkix/chartkit-core to 0.2.1

## 0.1.2 (2026-08-16)

### 🚀 Features

- **chartkit:** ship the Better Blocks block registration ready made ([#126](https://github.com/qkix/strapi-plugins/pull/126))

### ❤️ Thank You

- kkukielka

## 0.1.1 (2026-08-16)

### 🚀 Features

- **chartkit:** `hasAnyValue`, and a preview that says so instead of drawing an empty frame ([#124](https://github.com/qkix/strapi-plugins/pull/124))

  A spec with categories but no numbers renders axes, ticks and no marks. Valid,
  and useless to look at.

### 🐛 Bug Fixes

- **chartkit:** the dialog no longer discards a draft when the `spec` prop changes identity ([#124](https://github.com/qkix/strapi-plugins/pull/124))

  It now resets on the opening edge only. A host that rebuilds its spec object on
  render — which a Strapi edit view provokes on every keystroke in any other
  field — could wipe out a chart mid-edit.

- **chartkit:** the paste panel's textarea owns its field context ([#124](https://github.com/qkix/strapi-plugins/pull/124))

  Without one it inherited the surrounding field's error styling through the
  modal's portal, and painted itself red about someone else's problem.

### ❤️ Thank You

- kkukielka

## 0.1.0 (2026-08-16)

### 🚀 Features

- **chartkit:** the chart editor, stacked areas, and stackMode ([#122](https://github.com/qkix/strapi-plugins/pull/122))

### ❤️ Thank You

- kkukielka
