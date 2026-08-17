import { PLUGIN_ID } from './pluginId';

export default {
  register(app: any) {
    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID, isReady: true });
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
