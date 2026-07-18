import { createGlobalStyle } from 'styled-components';

/**
 * Strapi's design system hides the scrollbar on the popover behind the toolbar
 * dropdown menus (`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`),
 * and only scrolls on overflow. That means longer menus give no visual cue that
 * the list can be scrolled up and down.
 *
 * Every toolbar dropdown (block type, "+" insert, font size, font family,
 * alignment, line height, …) is built on the design-system `Menu` component, so
 * they all share a single scroll container: `[data-radix-menu-content]`. This
 * forces an always-visible, theme-aware scrollbar on it.
 *
 * Implementation notes (verified in Chromium):
 *   - `overflow-y: scroll` (not `auto`) keeps the scrollbar visible even when the
 *     content fits.
 *   - `scrollbar-width` must be overridden to `auto` (not `thin`) to un-hide the
 *     design-system's `none`. `auto` keeps the `::-webkit-scrollbar`
 *     pseudo-elements active, whereas `thin` — like `scrollbar-color` — makes
 *     Chromium fall back to an OS overlay scrollbar that is invisible until you
 *     scroll (defeating the purpose on macOS). We therefore do NOT set
 *     `scrollbar-color`; Firefox falls back to its own always-visible bar.
 *   - The track gets a real background so the channel stays visible even when the
 *     content fits and the thumb spans the full height; the colours are
 *     mid-range neutrals that contrast with the menu background (`neutral0`) in
 *     both the light and dark themes.
 *   - `!important` / `display: block` are required to beat the design-system
 *     rules, which share the same specificity.
 */
const MenuScrollbarStyles = createGlobalStyle`
  [data-radix-menu-content] {
    scrollbar-width: auto !important;
    overflow-y: scroll !important;
  }

  [data-radix-menu-content]::-webkit-scrollbar {
    display: block !important;
    width: 10px;
    height: 10px;
  }

  [data-radix-menu-content]::-webkit-scrollbar-track {
    background-color: ${({ theme }) => theme.colors.neutral200};
    border-radius: 10px;
  }

  [data-radix-menu-content]::-webkit-scrollbar-thumb {
    background-color: ${({ theme }) => theme.colors.neutral500};
    border-radius: 10px;
    border: 2px solid ${({ theme }) => theme.colors.neutral200};
  }

  [data-radix-menu-content]::-webkit-scrollbar-thumb:hover {
    background-color: ${({ theme }) => theme.colors.neutral600};
  }
`;

export { MenuScrollbarStyles };
