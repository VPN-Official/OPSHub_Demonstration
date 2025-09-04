import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const server = await createServer({
  root: process.cwd(),
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
  }
});

await server.listen();
server.printUrls();
console.log('Server running at http://localhost:5173');