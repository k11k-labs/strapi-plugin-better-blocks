---
'@k11k/better-blocks-react-renderer': minor
---

Fix social embeds never hydrating (TikTok, Pinterest) and not re-processing on remount

- Strip `<script>` tags from the injected embed HTML. Providers that ship their widget script inline in the oEmbed payload (TikTok always; pasted Instagram snippets often) left an inert `<script src="…">` in the DOM — inserted via `dangerouslySetInnerHTML` it never executes, but it matched the loader's `script[src="…"]` dedupe check, so the real widget script was never injected and the embed stayed a raw blockquote.
- Dedupe the loader on `script[data-bb-social-script="{platform}"]`, a marker only set on scripts the renderer injected itself.
- Re-process embeds mounted after the widget script has loaded (remount, client-side navigation). TikTok (`tiktokEmbed.lib.render()`) and Pinterest (`PinUtils.build()`) had no processor at all; when a platform global is missing the renderer now re-injects the script once so it rescans the document.
- `url` is now optional on `SocialEmbedNode` and the `social-embed` block override, matching the plugin allowing an embed saved with only an `embedCode`. The fallback card renders as a `<div>` rather than an `<a href="">` when there is no URL.
- The fallback card no longer repeats itself. With no oEmbed title or author it used to stack `View on X` over a provider line reading `X`; the provider line is now dropped in that case, and an author-only card reads `Post by <author>` over the provider.
