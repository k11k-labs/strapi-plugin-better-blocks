import * as React from 'react';
import { BlocksEditor } from './BlocksInput/BlocksEditor';
import { Field, Flex } from '@strapi/design-system';
import { useFetchClient } from '@strapi/admin/strapi-admin';
import * as Tooltip from '@radix-ui/react-tooltip';

interface PluginConfig {
  details?: { defaultSummary?: string; style?: 'github' | 'custom' };
}

/**
 * Plugin config (from config/plugins.js merged with server defaults) is fetched
 * once and cached across all Better Blocks fields on the page.
 */
let cachedConfig: PluginConfig | null = null;
let configPromise: Promise<PluginConfig> | null = null;

interface InputProps {
  attribute: {
    type: string;
    customField: string;
    options?: {
      required?: boolean;
      regex?: string;
      minLength?: number;
      unique?: boolean;
      disableDefaultColors?: boolean;
      customColorsPresets?: string;
      disableDefaultBgColors?: boolean;
      customBgColorsPresets?: string;
      detailsDefaultSummary?: string;
      detailsStyle?: 'github' | 'custom';
    };
  };
  description?: { id: string; defaultMessage: string };
  hint?: string;
  disabled?: boolean;
  intlLabel?: { id: string; defaultMessage: string };
  name: string;
  label: string;
  onChange: (e: {
    target: { name: string; type: string; value: string };
  }) => void;
  required?: boolean;
  value?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  // Get initial editor value
  const getInitialValue = () => {
    try {
      if (props.value) {
        const parsed =
          typeof props.value === 'string'
            ? JSON.parse(props.value)
            : props.value;
        return Array.isArray(parsed)
          ? parsed
          : [{ type: 'paragraph', children: [{ text: '' }] }];
      }
    } catch (e) {
      console.error('Failed to parse value:', e);
    }
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  };

  const [editorValue, setEditorValue] = React.useState(getInitialValue);

  // Fetch the admin-level plugin config (config/plugins.js) once and cache it.
  const { get } = useFetchClient();
  const [globalConfig, setGlobalConfig] = React.useState<PluginConfig | null>(
    cachedConfig
  );

  React.useEffect(() => {
    if (cachedConfig) return;
    if (!configPromise) {
      configPromise = get('/better-blocks/config')
        .then((res: { data: PluginConfig }) => {
          cachedConfig = res.data ?? {};
          return cachedConfig;
        })
        .catch(() => {
          cachedConfig = {};
          return cachedConfig;
        });
    }
    let active = true;
    configPromise.then((cfg) => {
      if (active) setGlobalConfig(cfg);
    });
    return () => {
      active = false;
    };
  }, [get]);

  // Per-field options (set in the content-type builder) override the global
  // config, which overrides the hardcoded defaults baked into the blocks.
  const fieldOptions = props.attribute.options;
  const pluginOptions = {
    ...fieldOptions,
    detailsDefaultSummary:
      fieldOptions?.detailsDefaultSummary ||
      globalConfig?.details?.defaultSummary,
    detailsStyle: fieldOptions?.detailsStyle || globalConfig?.details?.style,
  };

  const handleChange = (name: string, value: any) => {
    setEditorValue(value);

    props.onChange({
      target: {
        name,
        type: 'json',
        value: JSON.stringify(value),
      },
    });
  };

  return (
    <Tooltip.Provider>
      <Field.Root
        id={props.name}
        name={props.name}
        required={props.required}
        error={props.error}
        hint={props?.hint}
      >
        <Flex direction="column" alignItems="stretch" gap={1}>
          <Field.Label>{props.label}</Field.Label>
          <BlocksEditor
            ref={ref as any}
            name={props.name}
            error={props.error}
            value={editorValue}
            ariaLabelId={props.name}
            disabled={props.disabled}
            pluginOptions={pluginOptions}
            onChange={(eventOrPath, value) => {
              if (typeof eventOrPath === 'string') {
                handleChange(eventOrPath, value);
              } else {
                handleChange(props.name, eventOrPath.target.value);
              }
            }}
          />
          <Field.Hint />
          <Field.Error />
        </Flex>
      </Field.Root>
    </Tooltip.Provider>
  );
});

Input.displayName = 'BetterBlocksInput';

export default Input;
