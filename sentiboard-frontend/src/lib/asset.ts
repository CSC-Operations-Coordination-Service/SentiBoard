/* The site's base path in front of a path that Next does not prefix by itself.
   Next adds it to <Link>, router.push/replace and next/image, but not to a raw <a href>,
   <form action>, window.history.pushState/replaceState, <img src> or <source src>.
   next.config.ts exposes it as NEXT_PUBLIC_BASE_PATH (empty when the site is served at "/").
   Do not wrap what goes to <Link> or the router: they would get it twice. */

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const withBasePath = (path: string): string => `${BASE_PATH}${path}`;

/** A file in public/, e.g. asset("/assets/img/logo.png"). */
export const asset = withBasePath;
