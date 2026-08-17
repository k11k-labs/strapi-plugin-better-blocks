import type { Core } from '@strapi/strapi';

import { FIELDS_TO_IGNORE, isMorphRelation } from './serializer';
import type { RelationRef } from './serializer';
import { VERSION_UID } from './snapshot';
import { runAsRestore } from '../utils/captureContext';

export interface RestorePreview {
  /** Fields that will be written back. */
  fieldsToRestore: string[];
  /** In the model but not in the version - left exactly as they are. */
  fieldsKeptAsIs: string[];
  /** In the version but no longer in the model - skipped. */
  fieldsDropped: string[];
  /** Not localised, so restoring them changes every locale at once. */
  crossLocaleFields: string[];
  /** Polymorphic relations, which this version of the plugin does not carry. */
  unsupportedFields: string[];
  /** Relation targets that no longer exist. */
  brokenRelations: RelationRef[];
  /** Media that has since been deleted. */
  missingMedia: RelationRef[];
  /** Locales affected by the cross-locale fields above. */
  affectedLocales: string[];
}

type Attribute = Record<string, any>;

const restore = ({ strapi }: { strapi: Core.Strapi }) => {
  const model = (uid: string) =>
    strapi.getModel(uid as never) as unknown as {
      attributes: Record<string, Attribute>;
    };

  const loadVersion = async (versionId: number) => {
    const version = await strapi.db.query(VERSION_UID).findOne({ where: { id: versionId } });

    if (!version) {
      throw new Error(`No version with id ${versionId}`);
    }
    return version;
  };

  /** A field is per-locale only if i18n says so; everything else is shared. */
  const isFieldLocalized = (attribute: Attribute): boolean =>
    attribute?.pluginOptions?.i18n?.localized === true;

  /**
   * Whether the content type has localisation turned on at all.
   *
   * On a content type with a single locale every field is trivially "not
   * localised", and warning that a restore will change every locale - of which
   * there is one, the one being restored - is noise that teaches editors to
   * dismiss the dialog without reading it.
   */
  const isContentTypeLocalized = (uid: string): boolean =>
    (strapi.contentTypes[uid] as any)?.pluginOptions?.i18n?.localized === true;

  const targetExists = async (ref: RelationRef): Promise<boolean> => {
    if (ref.targetUid === 'plugin::upload.file') {
      const file = await strapi.db.query('plugin::upload.file').findOne({ where: { id: ref.id } });
      return Boolean(file);
    }

    const target = await strapi.db.query(ref.targetUid).findOne({
      where: {
        documentId: ref.documentId,
        ...(ref.locale ? { locale: ref.locale } : {}),
      },
    });
    return Boolean(target);
  };

  return {
    /**
     * What restoring this version would actually do.
     *
     * A separate call, and the UI shows it before asking for confirmation.
     * Restore without a preview of the consequences is a trap rather than a
     * tool - `crossLocaleFields` in particular, where restoring the Polish
     * version of a document quietly rewrites a field in every other language.
     */
    async preview(versionId: number): Promise<RestorePreview> {
      const version = await loadVersion(versionId);
      const uid: string = version.contentType;
      const attributes = model(uid).attributes;

      const versionSchema = (version.schemaSnapshot?.attributes ?? {}) as Record<string, Attribute>;
      const versionData = (version.data ?? {}) as Record<string, unknown>;
      const versionRelations = (version.relations ?? {}) as Record<string, RelationRef[]>;

      const liveFields = Object.keys(attributes).filter((name) => !FIELDS_TO_IGNORE.includes(name));
      const versionFields = Object.keys(versionSchema);

      const fieldsDropped = versionFields.filter((name) => !liveFields.includes(name));
      // Rule: a field added since this version keeps whatever it holds now.
      // Strapi's own restore nulls these, which loses data silently.
      const fieldsKeptAsIs = liveFields.filter((name) => !versionFields.includes(name));

      const restorable = versionFields.filter((name) => liveFields.includes(name));

      const unsupportedFields = restorable.filter((name) => isMorphRelation(attributes[name]));

      const fieldsToRestore = restorable.filter((name) => !unsupportedFields.includes(name));

      const crossLocaleFields = isContentTypeLocalized(uid)
        ? fieldsToRestore.filter((name) => !isFieldLocalized(attributes[name]))
        : [];

      const brokenRelations: RelationRef[] = [];
      const missingMedia: RelationRef[] = [];

      for (const [name, refs] of Object.entries(versionRelations)) {
        if (!fieldsToRestore.includes(name)) continue;

        for (const ref of refs) {
          if (await targetExists(ref)) continue;
          if (ref.targetUid === 'plugin::upload.file') missingMedia.push(ref);
          else brokenRelations.push(ref);
        }
      }

      const locales: { code: string }[] = crossLocaleFields.length
        ? await strapi.plugin('i18n')?.service('locales').find()
        : [];

      return {
        fieldsToRestore: fieldsToRestore.filter((name) => name in versionData),
        fieldsKeptAsIs,
        fieldsDropped,
        crossLocaleFields,
        unsupportedFields,
        brokenRelations,
        missingMedia,
        affectedLocales: locales.map((locale) => locale.code),
      };
    },

    /**
     * Writes the version back, to the draft only.
     *
     * The document lands in "modified" and publishing stays a deliberate act -
     * restoring must never change what the public sees on its own.
     */
    async apply(
      versionId: number,
      userId: number | null
    ): Promise<{ documentId: string; warnings: string[] }> {
      const version = await loadVersion(versionId);
      const uid: string = version.contentType;
      const preview = await this.preview(versionId);
      const warnings: string[] = [];

      // Everything is reversible: the state being replaced becomes a version of
      // its own before anything is written.
      await strapi.plugin('rewind').service('snapshot').capture(
        {
          uid,
          relatedDocumentId: version.relatedDocumentId,
          locale: version.locale,
          origin: 'restore',
          before: null,
        },
        userId
      );

      const data: Record<string, unknown> = {};
      const versionData = (version.data ?? {}) as Record<string, unknown>;
      const versionRelations = (version.relations ?? {}) as Record<string, RelationRef[]>;

      for (const name of preview.fieldsToRestore) {
        data[name] = versionData[name];
      }

      const broken = new Set(
        [...preview.brokenRelations, ...preview.missingMedia].map(
          (ref) => `${ref.targetUid}:${ref.documentId ?? ref.id}`
        )
      );

      for (const [name, refs] of Object.entries(versionRelations)) {
        if (preview.unsupportedFields.includes(name)) continue;
        if (preview.fieldsDropped.includes(name)) continue;

        const survivors = refs.filter(
          (ref) => !broken.has(`${ref.targetUid}:${ref.documentId ?? ref.id}`)
        );

        if (survivors.length !== refs.length) {
          warnings.push(
            `${refs.length - survivors.length} target(s) of "${name}" no longer exist and were skipped.`
          );
        }

        data[name] = survivors.map((ref) =>
          ref.targetUid === 'plugin::upload.file' ? ref.id : ref.documentId
        );
      }

      if (preview.fieldsDropped.length) {
        warnings.push(
          `Skipped ${preview.fieldsDropped.length} field(s) no longer in the model: ${preview.fieldsDropped.join(', ')}.`
        );
      }
      if (preview.crossLocaleFields.length) {
        warnings.push(
          `${preview.crossLocaleFields.join(', ')} are not localised, so they changed in every locale.`
        );
      }

      // The write restore performs is itself a document-service write. Without
      // this it would be captured as an ordinary edit, on top of the version
      // just taken of the pre-restore state.
      await runAsRestore(async () => {
        await strapi.documents(uid as never).update({
          documentId: version.relatedDocumentId,
          locale: version.locale ?? undefined,
          // Explicit, though update() forces draft anyway: passing 'published'
          // here would publish, and that must never happen by accident.
          status: 'draft',
          data,
        } as never);
      });

      return { documentId: version.relatedDocumentId, warnings };
    },
  };
};

export default restore;
