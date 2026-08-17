<h1 align="center">Greenlight for Strapi</h1>

<p align="center">Multi-stage content review for Strapi v5 — and <strong>nothing goes live until it has been approved</strong>.</p>

<p align="center">
  <a href="https://github.com/qkix/strapi-plugins/blob/main/LICENSE">
    <img alt="license" src="https://img.shields.io/badge/license-MIT-blue.svg" />
  </a>
  <a href="https://buymeacoffee.com/qkix">
    <img alt="Buy Me a Coffee" src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-FFDD00?logo=buymeacoffee&logoColor=black" />
  </a>
</p>

> **Status: in development.** The package is scaffolded and not yet published to
> npm. This README describes what it is being built to do; sections will fill in
> as the pieces land. Nothing here is a stable interface yet.

A document moves through stages — _Draft_, _In review_, _Approved_ — each with a
reviewer and its own rules about who may move it where. Until it reaches the
approved stage, **it cannot be published**.

## What this is, and what it is not

Strapi sells a feature called **Review Workflows** on its Enterprise plan.
Greenlight is not that feature, is not a drop-in replacement for it, and does not
share a line of code with it — it is written against the public documentation
only.

The important difference is not the price. In Strapi's implementation a stage is
a **label**, not a gate: an editor can open a document sitting in "In progress"
and hit Publish, and nothing stops them. The stage records an opinion about the
document; it does not govern it.

Greenlight's stages govern it. A document outside its approved stage is refused
at publish time, by a check on the server, whichever route the publish came in
by — the edit view, the list view's bulk action, the REST admin API, or your own
code calling the Document Service. That refusal is the product. Everything else
here exists to make it usable.

It is also, deliberately, unmetered: Strapi's plan limits the number of workflows
and stages you get. Greenlight does not limit either.

## Install

```sh
npm install @qkix/strapi-plugin-greenlight
```

Then enable it:

```ts
// config/plugins.ts
export default {
  greenlight: {
    enabled: true,
  },
};
```

Which content types are under review is **not** configured here — that lives on
the workflow, in the database, and is edited from the admin panel. A content type
can be put under review without a deploy.

## Configuration

| Option                    | Default | What it does                                                                                |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `hooks.onTransition`      | `null`  | Called after a stage change, with the transition just recorded. The hook for notifications. |
| `transitionRetentionDays` | `365`   | How long the transition log is kept.                                                        |

Greenlight does not send email. `onTransition` is where you do, and an error
thrown inside it is logged and swallowed — a notification failure must not be
able to undo a review decision that has already been written.

## License

MIT © [qkix](https://github.com/qkix)
