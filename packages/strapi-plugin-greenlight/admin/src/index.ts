import { CheckCircle } from '@strapi/icons';

import { ReviewPanel } from './components/ReviewPanel';
import { withPublishGuard } from './components/publishGuard';
import {
  INJECT_COLUMN_IN_TABLE,
  INJECT_LIST_VIEW_FILTERS,
  injectStageColumn,
  injectStageFilter,
} from './components/stageColumn';
import { primeCoverage } from './coverage';
import { PLUGIN_ID } from './pluginId';

export default {
  register(app: any) {
    app.registerPlugin({ id: PLUGIN_ID, name: PLUGIN_ID, isReady: true });

    /**
     * Start reading which content types are under review now, so the list
     * view's stage column can decide synchronously later. See stageColumn.tsx -
     * this runs before login on a cold boot and is expected to fail there.
     */
    void primeCoverage();

    /** The reviewer's own list, which is half the value of the product. */
    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: CheckCircle,
      intlLabel: { id: `${PLUGIN_ID}.menu.label`, defaultMessage: 'My reviews' },
      Component: async () => {
        const { QueuePage } = await import('./pages/QueuePage');
        return { default: QueuePage };
      },
      permissions: [{ action: `plugin::${PLUGIN_ID}.read`, subject: null }],
    });

    app.createSettingSection(
      {
        id: PLUGIN_ID,
        intlLabel: { id: `${PLUGIN_ID}.settings.section`, defaultMessage: 'Greenlight' },
      },
      [
        {
          id: `${PLUGIN_ID}-workflows`,
          to: `/settings/${PLUGIN_ID}`,
          intlLabel: { id: `${PLUGIN_ID}.settings.link`, defaultMessage: 'Review workflows' },
          Component: async () => {
            const { SettingsPage } = await import('./pages/SettingsPage');
            return { default: SettingsPage };
          },
          permissions: [{ action: `plugin::${PLUGIN_ID}.settings.configure`, subject: null }],
        },
      ]
    );
  },

  bootstrap(app: any) {
    const contentManager = app.getPlugin('content-manager');

    /** The stage, on every row of the list view, and a filter for it. */
    app.registerHook(INJECT_COLUMN_IN_TABLE, injectStageColumn);
    app.registerHook(INJECT_LIST_VIEW_FILTERS, injectStageFilter);

    /** Where the stage, the reviewer and the history live. */
    contentManager.apis.addEditViewSidePanel([ReviewPanel]);

    /**
     * Disabling the Publish button is a courtesy - the enforcement is a
     * document-service middleware on the server, which covers every route in
     * rather than only this one. Both exist on purpose.
     */
    contentManager.apis.addDocumentAction(withPublishGuard);

    /**
     * There is deliberately no warning inside the bulk-publish confirmation
     * dialog. `listView.publishModalAdditionalInfos` is declared in the Content
     * Manager's injection zones but nothing renders it in Strapi 5.52 - only
     * `editView.right-links`, `listView.actions` and `preview.actions` are live -
     * so a component registered there would silently never appear. Better to not
     * ship the feature than to ship one that looks registered and does nothing.
     */
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
