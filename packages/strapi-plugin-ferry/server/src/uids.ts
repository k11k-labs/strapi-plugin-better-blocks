/**
 * The plugin id, in one place.
 *
 * It appears in route paths, permission names and the admin panel's URL, so
 * changing it later breaks installs rather than merely renaming a thing.
 */
export const PLUGIN_ID = 'ferry';

/** Strapi's own file model. Media fields are relations to this. */
export const UPLOAD_FILE = 'plugin::upload.file';
