import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import { FIELD_NAME, PLUGIN_ID } from './pluginId';

export default {
  register(app: any) {
    app.registerPlugin({
      id: PLUGIN_ID,
      name: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
    });

    app.customFields.register({
      name: FIELD_NAME,
      pluginId: PLUGIN_ID,
      type: 'json',
      icon: PluginIcon,
      intlLabel: {
        id: `${PLUGIN_ID}.field.label`,
        defaultMessage: 'Chart',
      },
      intlDescription: {
        id: `${PLUGIN_ID}.field.description`,
        defaultMessage: 'A chart, rendered as SVG with no client-side JavaScript',
      },
      components: {
        // Lazy, so the editor and its data grid are not in the bundle of every
        // admin page — only of the ones that actually show a chart field.
        Input: async () => ({
          default: (await import('./components/ChartField')).default,
        }),
      },
      options: {
        base: [
          {
            sectionTitle: {
              id: `${PLUGIN_ID}.section.preview`,
              defaultMessage: 'Preview',
            },
            items: [
              {
                name: 'options.previewLocale',
                type: 'text',
                placeholder: {
                  id: `${PLUGIN_ID}.previewLocale.placeholder`,
                  defaultMessage: 'en-US',
                },
                intlLabel: {
                  id: `${PLUGIN_ID}.previewLocale`,
                  defaultMessage: 'Number formatting locale',
                },
                description: {
                  id: `${PLUGIN_ID}.previewLocale.description`,
                  defaultMessage:
                    "How axis numbers are formatted in the admin preview — a BCP 47 tag such as de-DE or pl-PL. Affects the preview only; the front end passes its own locale when it renders. Left empty, the browser's is used.",
                },
              },
            ],
          },
        ],
        advanced: [
          {
            sectionTitle: null,
            items: [
              {
                name: 'required',
                type: 'checkbox',
                intlLabel: {
                  id: `${PLUGIN_ID}.required`,
                  defaultMessage: 'Required field',
                },
                description: {
                  id: `${PLUGIN_ID}.required.description`,
                  defaultMessage: "You won't be able to create an entry if this field is empty",
                },
              },
            ],
          },
        ],
      },
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(`./translations/${locale}.json`);
          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};

/**
 * Re-exported so an app that stores a chart in this field and renders it
 * elsewhere — a preview route, a custom admin page — does not need a second
 * install to get at the spec's type or to draw one.
 */
export { readValue, writeValue, starterSpec } from './value';
export type { ReadValue } from './value';
export { FIELD_NAME, PLUGIN_ID } from './pluginId';
export type { ChartSpec, ChartType, Series, ChartOptions } from '@qkix/chartkit-core';
