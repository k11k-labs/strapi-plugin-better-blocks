/**
 * The server half of the plugin.
 *
 * Deliberately just a registration. Charts render from their spec, so there is
 * no chart data to store beyond the field itself, no routes to serve it over
 * and no service to compute it — a Chartkit content type would be a second
 * place for the same numbers to live and drift.
 */

import register from './register';

export default {
  register,
};
