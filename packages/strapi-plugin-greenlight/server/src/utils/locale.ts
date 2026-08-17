/**
 * The empty string stands for "this content type has no locales".
 *
 * Not `null`, and this is not a style choice. In Postgres, SQLite and MySQL a
 * `NULL` is not equal to another `NULL` inside a unique index, so
 * `UNIQUE (related_document_id, content_type_uid, locale)` would happily accept
 * the same document twice as soon as `locale` were null - which is exactly the
 * case for every content type without i18n. The duplicate assignments would then
 * disagree about which stage the document is in.
 *
 * Every read and every write goes through here, so the column can never hold a
 * null in the first place.
 */
export const normalizeLocale = (locale: string | null | undefined): string => locale ?? '';

/** The inverse, for API responses and anything user-facing. */
export const denormalizeLocale = (locale: string): string | null => (locale === '' ? null : locale);
