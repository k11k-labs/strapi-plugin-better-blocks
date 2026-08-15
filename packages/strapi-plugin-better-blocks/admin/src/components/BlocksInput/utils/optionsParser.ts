/**
 * Parses a string formatted as "Label:value\nLabel2:value2" into an array of options
 * If no colon is found, the value is used as both label and value
 * @param presetString The string to parse
 * @returns Array of {label, value} objects
 */
export const parsePresetString = (presetString?: string) => {
  if (!presetString) {
    return [];
  }

  return presetString
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        // If no colon found, use the value as both label and value
        return { label: line, value: line };
      }

      // Otherwise, split at the first colon
      const label = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();

      return { label, value };
    });
};

/**
 * Gets the custom options from plugin config if available and enabled
 * Falls back to default options if not
 */
export const getOptionsWithFallback = (
  defaultOptions: Array<{ label: string; value: string }>,
  customPresets?: string,
  useCustom?: boolean
) => {
  if (useCustom && customPresets) {
    const parsedOptions = parsePresetString(customPresets);
    return parsedOptions.length > 0 ? parsedOptions : defaultOptions;
  }

  return defaultOptions;
};

// Simple test function to validate the parsing logic works correctly
// This is for development and debugging purposes only
export const _testParser = () => {
  const tests = [
    {
      name: 'Parse font presets with labels and values',
      input: 'Sans Regular:sans-regular\nSlab:slab\nScript:script',
      expected: [
        { label: 'Sans Regular', value: 'sans-regular' },
        { label: 'Slab', value: 'slab' },
        { label: 'Script', value: 'script' },
      ],
    },
    {
      name: 'Parse color presets with labels and values',
      input: 'Midnight:#171725\nSB Blue:#0057FF',
      expected: [
        { label: 'Midnight', value: '#171725' },
        { label: 'SB Blue', value: '#0057FF' },
      ],
    },
    {
      name: 'Parse size presets with no labels',
      input: '12\n14\n16\n20',
      expected: [
        { label: '12', value: '12' },
        { label: '14', value: '14' },
        { label: '16', value: '16' },
        { label: '20', value: '20' },
      ],
    },
    {
      name: 'Empty string',
      input: '',
      expected: [],
    },
    {
      name: 'String with empty lines',
      input: 'Line1:value1\n\nLine2:value2\n',
      expected: [
        { label: 'Line1', value: 'value1' },
        { label: 'Line2', value: 'value2' },
      ],
    },
  ];

  const results = tests.map((test) => {
    const result = parsePresetString(test.input);
    const passed = JSON.stringify(result) === JSON.stringify(test.expected);

    return {
      name: test.name,
      passed,
      input: test.input,
      expected: test.expected,
      actual: result,
    };
  });

  console.log('Parser test results:', results);
  return results;
};
