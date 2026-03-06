import * as React from 'react';
import { BlocksEditor } from './BlocksInput/BlocksEditor';
import { Field, Flex } from '@strapi/design-system';
import * as Tooltip from '@radix-ui/react-tooltip';

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
            pluginOptions={props.attribute.options}
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
