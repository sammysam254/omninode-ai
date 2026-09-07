import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      port: 5173,
      host: true
    },
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(
        env.VITE_SUPABASE_URL || env.SUPABASE_URL || 'https://xfednxvbjzfssxyaurbc.supabase.co'
      ),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(
        env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || ''
      ),
      'import.meta.env.VITE_OPENROUTER_API_KEY': JSON.stringify(
        env.VITE_OPENROUTER_API_KEY || env.OPENROUTER_API_KEY || ''
      ),
      'import.meta.env.VITE_GROK_API_KEY': JSON.stringify(
        env.VITE_GROK_API_KEY || env.GROK_API_KEY || ''
      ),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(
        env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY || ''
      )
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
