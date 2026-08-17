// `Graph` - nodes joined by edges, which is what this draws. Deliberately not
// `Layout`: that is the Content-Type Builder's icon, and two neighbouring items
// in the same menu with the same glyph is a menu you have to read twice.
import { Graph } from '@strapi/icons';

import { PLUGIN_ID } from './pluginId';

export default {
  register(app: any) {
    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID, isReady: true });

    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: Graph,
      intlLabel: { id: `${PLUGIN_ID}.menu.label`, defaultMessage: 'Blueprint' },
      Component: async () => {
        const { DiagramPage } = await import('./pages/DiagramPage');
        return { default: DiagramPage };
      },
      permissions: [{ action: `plugin::${PLUGIN_ID}.read`, subject: null }],
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

export { PLUGIN_ID } from './pluginId';
