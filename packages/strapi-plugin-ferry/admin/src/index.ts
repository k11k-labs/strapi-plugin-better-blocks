// `ArrowsHorizontal` - content going out and content coming in, which is the
// whole plugin. Deliberately not `Upload` or `Download`: each of those names
// one direction, and picking either makes the menu entry look like half of
// what it is. `Archive` was the other candidate and reads as storage rather
// than movement.
import { ArrowsHorizontal } from '@strapi/icons';

import { PLUGIN_ID } from './pluginId';

export default {
  register(app: any) {
    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID, isReady: true });

    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: ArrowsHorizontal,
      intlLabel: { id: `${PLUGIN_ID}.menu.label`, defaultMessage: 'Ferry' },
      Component: async () => {
        const { TransferPage } = await import('./pages/TransferPage');
        return { default: TransferPage };
      },
      permissions: [{ action: `plugin::${PLUGIN_ID}.export`, subject: null }],
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
