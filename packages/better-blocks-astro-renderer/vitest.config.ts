import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    // Astro components are rendered to HTML strings via the experimental
    // container API, so a DOM environment is not required.
    environment: 'node',
  },
});
