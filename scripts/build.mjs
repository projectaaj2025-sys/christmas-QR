// The site is plain static files at the repository root (GitHub Pages serves
// them directly). The build only mirrors them into dist/ for other hosts.
import { cp, mkdir, rm } from 'node:fs/promises';

const files = ['index.html', 'embed.html', 'styles.css', '.nojekyll', 'js'];
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
for (const f of files) await cp(f, 'dist/' + f, { recursive: true });
console.log('dist/ built from the repository root');
