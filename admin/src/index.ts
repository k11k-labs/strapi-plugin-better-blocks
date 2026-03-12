import { PLUGIN_ID } from './pluginId';
import { Initializer } from './components/Initializer';
import { PluginIcon } from './components/PluginIcon';
import Input from './components/Input';
import * as yup from 'yup';

export default {
  register(app: any) {
    app.registerPlugin({
      id: PLUGIN_ID,
      name: PLUGIN_ID,
      initializer: Initializer,
      isReady: false,
    });

    app.customFields.register({
      name: PLUGIN_ID,
      pluginId: PLUGIN_ID,
      type: 'json',
      icon: PluginIcon,
      required: true,
      intlLabel: {
        id: `${PLUGIN_ID}.field.label`,
        defaultMessage: 'Better Blocks',
      },
      intlDescription: {
        id: `${PLUGIN_ID}.field.description`,
        defaultMessage:
          'An enhanced Rich Text (Blocks) field with inline color picker and more',
      },
      components: {
        Input: async () => ({ default: Input }),
      },
      options: {
        base: [
          {
            sectionTitle: {
              id: `${PLUGIN_ID}.section.color-settings`,
              defaultMessage: 'Text Color Settings (Label:#HEX)',
            },
            items: [
              {
                name: 'options.disableDefaultColors',
                type: 'checkbox',
                intlLabel: {
                  id: `${PLUGIN_ID}.disableDefaultColors`,
                  defaultMessage: 'Disable default text colors?',
                },
                description: {
                  id: `${PLUGIN_ID}.disableDefaultColors.description`,
                  defaultMessage:
                    'If enabled, custom text color presets will be used',
                },
              },
              {
                name: 'options.customColorsPresets',
                type: 'textarea',
                placeholder: {
                  id: `${PLUGIN_ID}.customColorsPresets.placeholder`,
                  defaultMessage:
                    'Black:#000000\nWhite:#FFFFFF\nGray:#808080\nRed:#FF0000\nBlue:#0000FF\nGreen:#00FF00',
                },
                intlLabel: {
                  id: `${PLUGIN_ID}.customColorsPresets`,
                  defaultMessage: 'Custom text color presets',
                },
                description: {
                  id: `${PLUGIN_ID}.customColorsPresets.description`,
                  defaultMessage:
                    'These values will override default text color options. One per line.',
                },
              },
            ],
          },
          {
            sectionTitle: {
              id: `${PLUGIN_ID}.section.bg-color-settings`,
              defaultMessage: 'Background Color Settings (Label:#HEX)',
            },
            items: [
              {
                name: 'options.disableDefaultBgColors',
                type: 'checkbox',
                intlLabel: {
                  id: `${PLUGIN_ID}.disableDefaultBgColors`,
                  defaultMessage: 'Disable default background colors?',
                },
                description: {
                  id: `${PLUGIN_ID}.disableDefaultBgColors.description`,
                  defaultMessage:
                    'If enabled, custom background color presets will be used',
                },
              },
              {
                name: 'options.customBgColorsPresets',
                type: 'textarea',
                placeholder: {
                  id: `${PLUGIN_ID}.customBgColorsPresets.placeholder`,
                  defaultMessage:
                    'Yellow:#FFF3BF\nGreen:#D3F9D8\nBlue:#D0EBFF\nPink:#FFE0E6\nPurple:#E5DBFF',
                },
                intlLabel: {
                  id: `${PLUGIN_ID}.customBgColorsPresets`,
                  defaultMessage: 'Custom background color presets',
                },
                description: {
                  id: `${PLUGIN_ID}.customBgColorsPresets.description`,
                  defaultMessage:
                    'These values will override default background color options. One per line.',
                },
              },
            ],
          },
        ],
        validator: (args: any) => {
          const {
            disableDefaultColors = false,
            disableDefaultBgColors = false,
          } = args[2].modifiedData.options || {};

          const hasDuplicateLines = (lines: string[]) => {
            const uniqueLines = new Set(lines);
            return lines.length !== uniqueLines.size;
          };

          const validateStringPreset = (value: string | undefined) => {
            if (!value) return true;

            const lines = value.split('\n');
            const lineRegex =
              /^[a-zA-Z]+(?:\s+[a-zA-Z]+)*:(?:[a-zA-Z][-a-zA-Z0-9]*|#[0-9A-Fa-f]+)$/;

            if (lines.some((line) => !line || line.trim() === '')) return false;
            if (!lines.every((line) => lineRegex.test(line))) return false;
            if (hasDuplicateLines(lines)) return false;

            return true;
          };

          const errorMessages = {
            required: 'This field is required',
            badStringFormat:
              'Each line must be in format "Label:#HEX" (no duplicates allowed)',
          };

          const fgSchema = disableDefaultColors
            ? yup.string().required(errorMessages.required)
            : yup.string().optional();

          const bgSchema = disableDefaultBgColors
            ? yup.string().required(errorMessages.required)
            : yup.string().optional();

          return {
            customColorsPresets: fgSchema.test(
              'customColorsPresets',
              {
                id: 'error.customColorsPresets',
                defaultMessage: errorMessages.badStringFormat,
              },
              validateStringPreset
            ),
            customBgColorsPresets: bgSchema.test(
              'customBgColorsPresets',
              {
                id: 'error.customBgColorsPresets',
                defaultMessage: errorMessages.badStringFormat,
              },
              validateStringPreset
            ),
          };
        },
      },
    });
  },

  async registerTrads({ locales }: { locales: string[] }) {
    return Promise.all(
      locales.map(async (locale) => {
        try {
          const { default: data } = await import(
            `./translations/${locale}.json`
          );
          return { data, locale };
        } catch {
          return { data: {}, locale };
        }
      })
    );
  },
};
