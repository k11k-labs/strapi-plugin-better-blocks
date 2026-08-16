export const PLUGIN_ID = 'chartkit';

/**
 * The custom field's name, which is not the plugin's.
 *
 * A field is referred to as `plugin::chartkit.chart` in a content-type schema,
 * so the plugin is the namespace and this is the field inside it. Naming both
 * `chartkit` would read as `plugin::chartkit.chartkit`.
 */
export const FIELD_NAME = 'chart';
