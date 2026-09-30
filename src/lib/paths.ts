/**
 * The type to give a computed path before `resolve()`: `resolve(localizeHref(to) as AppPath)`.
 *
 * `resolve` only prepends the app's base path, but its argument type is a union over every route,
 * and past about two dozen routes TypeScript can no longer check a union-typed argument against
 * it (a union of one-item tuples). One valid route stands in for "any path we built ourselves";
 * this is what `$app/types` `Pathname` was doing until the app grew past that size.
 */
export type AppPath = '/';
