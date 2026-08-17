import config from './config';

/**
 * The scaffold. It boots, it registers, and it does nothing else yet.
 *
 * What lands here next, in order, and why the order matters:
 *
 *   content-types  the four tables, plus the `persisted_tables` entry that stops
 *                  Strapi dropping them the first time the plugin is disabled
 *   services       workflow / assignment / permission — the model, testable
 *                  without any of the wiring below
 *   register       the publish gate, as a `strapi.documents.use()` middleware.
 *                  In `register()` rather than `bootstrap()` on purpose: document
 *                  service middlewares run in registration order, and Rewind
 *                  registers its own in `bootstrap()`, so a gate registered here
 *                  sits outside it and a refused publish never records a version.
 *   destroy        releasing the handle `documents.use()` hands back, so repeated
 *                  boots in a test harness do not stack middlewares.
 */
export default {
  config,
};
