/**
 * Reading a data file out of Strapi's Media Library.
 *
 * The only part of this package that knows it is running inside the Strapi
 * admin, kept in its own file for that reason: the dialog is looked up at
 * runtime and everything degrades to "the button is disabled" when it is not
 * there.
 *
 * What arrives is text. It then goes through exactly the same parser and the
 * same confirm-before-replacing panel as a paste, because a file is no more
 * trustworthy than a paste - the header guess and the number formats are the
 * same problem either way.
 *
 * Reading the file itself lives in `media.ts`, which imports nothing from
 * Strapi and can therefore be tested on its own.
 */

import { useStrapiApp } from '@strapi/admin/strapi-admin';
import * as React from 'react';

export type MediaLibraryDialogProps = {
  allowedTypes: string[];
  onClose: () => void;
  onSelectAssets: (assets: Record<string, unknown>[]) => void;
};

/**
 * The Media Library dialog, if this build of the admin provides one.
 *
 * Looked up through the app registry rather than imported, which is how Strapi
 * exposes it - and means a version that does not have it leaves the caller with
 * `undefined` instead of a broken import.
 */
export function useMediaLibraryDialog(): React.ComponentType<MediaLibraryDialogProps> | undefined {
  const components = useStrapiApp('ChartEditor', (state) => state.components);

  return components?.['media-library'] as React.ComponentType<MediaLibraryDialogProps> | undefined;
}
