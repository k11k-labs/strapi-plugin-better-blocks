import * as React from 'react';

import { Layouts, Page, useFetchClient } from '@strapi/admin/strapi-admin';
import {
  Box,
  Button,
  Checkbox,
  Flex,
  Loader,
  SingleSelect,
  SingleSelectOption,
  Typography,
} from '@strapi/design-system';
import { Download } from '@strapi/icons';
import { useNavigate } from 'react-router-dom';

import { Canvas, INITIAL_VIEW } from '../components/Canvas';
import type { View } from '../components/Canvas';
import { DEFAULT_OPTIONS, downloadSvg, loadOptions, routes, saveOptions, toParams } from '../api';
import type { DiagramOptions, DiagramResponse } from '../api';

/**
 * Where clicking a box takes you.
 *
 * A diagram whose boxes are dead ends makes you find the thing again by hand;
 * the Content-Type Builder is where you were going anyway. Components live
 * under a different route, keyed by their category.
 */
const builderPath = (uid: string): string => {
  if (uid.includes('::')) return `/plugins/content-type-builder/content-types/${uid}`;

  // `shared.link` → `component-categories/shared/shared.link`. The category
  // alone is not a route: it lands on the builder's default page, which is
  // whichever content type comes first.
  const [category] = uid.split('.');
  return `/plugins/content-type-builder/component-categories/${category}/${uid}`;
};

export const DiagramPage = () => {
  const { get } = useFetchClient();
  const navigate = useNavigate();

  const [options, setOptions] = React.useState<DiagramOptions>(loadOptions);
  const [diagram, setDiagram] = React.useState<DiagramResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [view, setView] = React.useState<View>(INITIAL_VIEW);
  const [refit, setRefit] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    get<DiagramResponse>(routes.diagram, { params: toParams(options) })
      .then(({ data }) => {
        if (!alive) return;
        setDiagram(data);
      })
      .catch(() => alive && setError('Could not build the diagram.'))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [get, options]);

  const update = (patch: Partial<DiagramOptions>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    saveOptions(next);
  };

  const counts = diagram?.counts;

  return (
    <Page.Main>
      <Layouts.Header
        title="Blueprint"
        subtitle={
          counts
            ? `${counts.nodes} types, ${counts.components} components, ${counts.edges} relations`
            : 'Your content types and how they fit together'
        }
        primaryAction={
          <Button
            startIcon={<Download />}
            variant="secondary"
            disabled={!diagram}
            onClick={() => diagram && downloadSvg(diagram.svg)}
          >
            Download SVG
          </Button>
        }
      />

      <Layouts.Content>
        <Flex gap={4} wrap="wrap" paddingBottom={4} alignItems="center">
          <Checkbox
            checked={options.components}
            onCheckedChange={(value: boolean) => update({ components: Boolean(value) })}
          >
            Components &amp; dynamic zones
          </Checkbox>
          <Checkbox
            checked={options.defaultFields}
            onCheckedChange={(value: boolean) => update({ defaultFields: Boolean(value) })}
          >
            Strapi&apos;s own fields
          </Checkbox>
          <Checkbox
            checked={options.foreign}
            onCheckedChange={(value: boolean) => update({ foreign: Boolean(value) })}
          >
            Plugin content types
          </Checkbox>

          <Box minWidth="180px">
            <SingleSelect
              aria-label="Layout direction"
              value={options.direction}
              onChange={(value: string | number) =>
                update({ direction: value === 'LR' ? 'LR' : 'TB' })
              }
            >
              <SingleSelectOption value="TB">Top to bottom</SingleSelectOption>
              <SingleSelectOption value="LR">Left to right</SingleSelectOption>
            </SingleSelect>
          </Box>

          <Button variant="tertiary" onClick={() => setRefit((value) => value + 1)}>
            Fit to screen
          </Button>
          <Button
            variant="tertiary"
            onClick={() => {
              setOptions(DEFAULT_OPTIONS);
              saveOptions(DEFAULT_OPTIONS);
            }}
          >
            Reset options
          </Button>
        </Flex>

        <Box
          hasRadius
          borderColor="neutral200"
          borderWidth="1px"
          borderStyle="solid"
          style={{ height: '70vh' }}
        >
          {loading ? (
            <Flex justifyContent="center" alignItems="center" height="100%">
              <Loader small>Building the diagram</Loader>
            </Flex>
          ) : error ? (
            <Flex justifyContent="center" alignItems="center" height="100%">
              <Typography textColor="danger600">{error}</Typography>
            </Flex>
          ) : diagram && diagram.counts.nodes > 0 ? (
            <Canvas
              svg={diagram.svg}
              view={view}
              onViewChange={setView}
              fitTo={{ width: diagram.width, height: diagram.height }}
              refit={refit}
              onOpen={(uid) => navigate(builderPath(uid))}
            />
          ) : (
            <Flex
              justifyContent="center"
              alignItems="center"
              height="100%"
              direction="column"
              gap={2}
            >
              <Typography variant="delta">Nothing to draw yet</Typography>
              <Typography textColor="neutral600">
                Create a content type, or switch on plugin content types above.
              </Typography>
            </Flex>
          )}
        </Box>

        <Box paddingTop={2}>
          <Typography variant="pi" textColor="neutral600">
            Drag to pan, scroll to zoom, click a box to open it in the Content-Type Builder. Solid
            lines are relations, dashed are components, dotted are dynamic zones.
          </Typography>
        </Box>
      </Layouts.Content>
    </Page.Main>
  );
};

export default DiagramPage;
