import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  main: {
    // Bundle electron-updater (and its deps) into the main bundle rather than
    // externalizing it. The packaged app ships no node_modules (see the lean
    // `files` config in electron-builder.cjs), so a runtime require of an
    // externalized electron-updater would fail — inlining it keeps the package
    // small while making the updater available.
    plugins: [externalizeDepsPlugin({ exclude: ['electron-updater'] })],
    build: {
      rollupOptions: {
        output: {
          format: 'es',
          entryFileNames: '[name].mjs'
        }
      }
    },
    resolve: {
      alias: {
        '@main': resolve('src/main')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: { format: 'cjs' }
      }
    }
  },
  renderer: {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve('src/renderer')
      }
    }
  }
})
