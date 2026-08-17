import type { Core } from '@strapi/strapi';

/**
 * Registers the chart custom field.
 *
 * `json`, because a chart is a spec - a type, some labels, some series - and
 * the alternatives are worse. A relation would need a content type nobody
 * asked for; text would need every consumer to parse it and guess at what
 * failure means.
 *
 * The stored value is a `ChartSpec` from `@qkix/chartkit-core`, which is also
 * exactly what the renderers take. A front end reads the field and passes it
 * straight to `<Chart spec={...} />` with nothing in between.
 */
const register = ({ strapi }: { strapi: Core.Strapi }) => {
  strapi.customFields.register({
    name: 'chart',
    plugin: 'chartkit',
    type: 'json',
    inputSize: {
      // Full width. The field is a chart preview above a data grid, and half a
      // row is not enough for either.
      default: 12,
      isResizable: false,
    },
  });
};

export default register;
