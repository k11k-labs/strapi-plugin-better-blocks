<h1 align="center">Strapi - Better Blocks Plugin</h1>

<p align="center">An enhanced Rich Text (Blocks) editor for Strapi v5 with inline text color, background highlight, and more.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@k11k/strapi-plugin-better-blocks">
    <img alt="npm version" src="https://img.shields.io/npm/v/@k11k/strapi-plugin-better-blocks.svg" />
  </a>
  <a href="https://www.npmjs.com/package/@k11k/strapi-plugin-better-blocks">
    <img alt="npm downloads" src="https://img.shields.io/npm/dm/@k11k/strapi-plugin-better-blocks.svg" />
  </a>
  <a href="https://github.com/k11k-labs/strapi-plugin-better-blocks/blob/main/LICENSE">
    <img alt="license" src="https://img.shields.io/npm/l/@k11k/strapi-plugin-better-blocks.svg" />
  </a>
</p>

<p align="center">
  <img src="./docs/better-blocks-demo.gif" alt="Better Blocks Demo" width="800" />
</p>

---

## Table of Contents

1. [Features](#features)
2. [Compatibility](#compatibility)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Usage](#usage)
6. [Custom Color Presets](#custom-color-presets)
7. [Frontend Rendering](#frontend-rendering)
8. [Contributing](#contributing)
9. [License](#license)

---

## Features

- **Inline Text Color** &mdash; Apply foreground color to selected text from a configurable palette
- **Background Highlight** &mdash; Apply background color to selected text for highlighting
- **Live Preview Button** &mdash; The toolbar button reflects the currently active text and highlight colors
- **Customizable Palettes** &mdash; Define custom color presets per field via Content-Type Builder
- **Dark & Light Mode** &mdash; Fully compatible with both Strapi themes
- **Drop-in Replacement** &mdash; Works as a custom field alongside the native Rich Text (Blocks) field
- **Nested Lists** &mdash; Infinitely nestable ordered and unordered lists with per-level format switching (Tab to indent, Shift+Tab to outdent)
- **Full Blocks Editor** &mdash; Paragraphs, headings, lists, links, quotes, code blocks, and all standard text modifiers (bold, italic, underline, strikethrough, code, uppercase, superscript, subscript)

## Compatibility

| Strapi Version | Plugin Version |
| -------------- | -------------- |
| v5.x           | v0.1.x         |

## Installation

```bash
# Using yarn
yarn add @k11k/strapi-plugin-better-blocks

# Using npm
npm install @k11k/strapi-plugin-better-blocks
```

After installation, rebuild your Strapi admin panel:

```bash
yarn build
# or
npm run build
```

## Configuration

### 1. Enable the plugin

Add the plugin to your Strapi configuration in `config/plugins.ts` (or `config/plugins.js`):

```ts
// config/plugins.ts
export default () => ({
  'better-blocks': {
    enabled: true,
  },
});
```

### 2. Restart Strapi

```bash
yarn develop
```

### 3. Add a Better Blocks field

1. Go to **Content-Type Builder**
2. Select or create a content type
3. Click **Add new field**
4. Switch to the **CUSTOM** tab
5. Select **Better Blocks**
6. Configure the field name and color settings
7. Save and wait for Strapi to restart

## Usage

Once added to a content type, the Better Blocks field provides an enhanced Rich Text editor with:

### Text Color

1. Select text in the editor
2. Click the **A** button in the toolbar
3. Switch to the **Text** tab
4. Choose a color from the palette
5. Click **Remove color** to reset

### Background Highlight

1. Select text in the editor
2. Click the **A** button in the toolbar
3. Switch to the **Highlight** tab
4. Choose a background color from the palette
5. Click **Remove highlight** to reset

The toolbar button shows a live preview of the active colors &mdash; the icon color reflects the text color, and the button background reflects the highlight color.

## Custom Color Presets

You can customize both text and background color palettes per field in the Content-Type Builder:

### Text Colors

In the field's **Base settings**:

- **Disable default text colors** &mdash; Check to replace default colors with your own
- **Custom text color presets** &mdash; One color per line in `Label:#HEX` format

Example:

```
Black:#000000
White:#FFFFFF
Brand Red:#E53E3E
Brand Blue:#3182CE
```

### Background Colors

- **Disable default background colors** &mdash; Check to replace default highlights with your own
- **Custom background color presets** &mdash; One color per line in `Label:#HEX` format

Example:

```
Warning:#FED7D7
Info:#BEE3F8
Success:#C6F6D5
Neutral:#EDF2F7
```

### Default Palettes

**Text colors:** Teal, Dark, Gray, Light Gray, Silver, Medium Gray, White

**Background colors:** Yellow, Green, Blue, Pink, Purple, Orange, Gray, Teal, Red, Cyan

## Frontend Rendering

To render Better Blocks content in your React frontend, use the companion renderer:

```bash
# Using yarn
yarn add @k11k/better-blocks-react-renderer

# Using npm
npm install @k11k/better-blocks-react-renderer
```

```tsx
import { BlocksRenderer } from '@k11k/better-blocks-react-renderer';

const MyComponent = ({ content }) => {
  return <BlocksRenderer content={content} />;
};
```

The renderer supports all Better Blocks features including text colors, background highlights, images, and all standard block types.

See the [@k11k/better-blocks-react-renderer](https://github.com/k11k-labs/better-blocks-react-renderer) repository for full documentation.

## Requirements

- **Node.js** &ge; 20.0.0
- **Strapi** v5.x
- **Slate** 0.94.1 (bundled with Strapi)

## Contributing

Contributions are welcome! The easiest way to get started is with Docker:

```bash
# Clone the repository
git clone https://github.com/k11k-labs/strapi-plugin-better-blocks.git
cd strapi-plugin-better-blocks

# Start the playground with Docker
docker compose up
```

This will automatically build the plugin and start a Strapi v5 app (SQLite) at `http://localhost:1337/admin`.

On first launch, create an admin account, then go to **Content-Type Builder** &rarr; **Add new field** &rarr; **CUSTOM** tab &rarr; **Better Blocks** to try it out.

### Development workflow

1. Make changes to the plugin source in `admin/src/` or `server/src/`
2. Restart the container to rebuild and pick up changes:
   ```bash
   docker compose restart
   ```

### Full reset

To wipe the database and node_modules and start fresh:

```bash
docker compose down -v && docker compose up
```

### Without Docker

```bash
yarn install && yarn build
cd playground/strapi && npm install && npm run develop
```

## Community & Support

- [GitHub Issues](https://github.com/k11k-labs/strapi-plugin-better-blocks/issues) &mdash; Bug reports and feature requests
- [GitHub Discussions](https://github.com/k11k-labs/strapi-plugin-better-blocks/discussions) &mdash; Questions and ideas

## License

[MIT License](LICENSE) &copy; [k11k-labs](https://github.com/k11k-labs)
