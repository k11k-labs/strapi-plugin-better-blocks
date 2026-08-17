import { HistoryPanel } from './components/HistoryPanel';
import { PLUGIN_ID } from './pluginId';

export default {
  register(app: any) {
    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID, isReady: true });
  },

  bootstrap(app: any) {
    /**
     * `addEditViewSidePanel` is the supported way in. The older
     * `injectComponent('editView', 'right-links')` still works but crowds the
     * header, and `editView.informations` is marked internal in Strapi's docs.
     */
    app.getPlugin('content-manager').apis.addEditViewSidePanel([HistoryPanel]);
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
/**
 * The hook a package owning a field format uses to render its own diff - see
 * diffRegistry for why this is a registry and not a switch.
 */
export { registerDiffRenderer } from './diffRegistry';
export type { DiffRenderer, FieldChange, DiffSpan } from './diffRegistry';
