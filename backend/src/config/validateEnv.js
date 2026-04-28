/**
 * Environment Validator
 * Validates all required environment variables on startup.
 * Crashes with a clear error rather than failing mysteriously at runtime.
 */

const REQUIRED = [
  { key: 'DATABASE_URL',     desc: 'PostgreSQL connection string' },
  { key: 'REDIS_URL',        desc: 'Redis connection string' },
  { key: 'ANTHROPIC_API_KEY',desc: 'Claude API key for task extraction' },
  { key: 'JWT_SECRET',       desc: 'Secret for signing JWT tokens' },
];

const RECOMMENDED = [
  { key: 'ASSEMBLYAI_API_KEY', desc: 'AssemblyAI for speaker diarization (falls back to Whisper)' },
  { key: 'OPENAI_API_KEY',     desc: 'OpenAI Whisper fallback transcription' },
  { key: 'SMTP_HOST',          desc: 'SMTP server for email notifications' },
  { key: 'AWS_S3_BUCKET',      desc: 'S3 bucket for audio file storage' },
];

function validateEnv() {
  const missing = REQUIRED.filter(v => !process.env[v.key]);

  if (missing.length > 0) {
    console.error('\n❌ Missing required environment variables:\n');
    missing.forEach(v => console.error(`   ${v.key.padEnd(24)} — ${v.desc}`));
    console.error('\nCopy .env.example to .env and fill in the required values.\n');
    process.exit(1);
  }

  // JWT secret strength check
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('\n❌ JWT_SECRET must be at least 32 characters long for security.\n');
    process.exit(1);
  }

  // Warn about recommended vars in production
  if (process.env.NODE_ENV === 'production') {
    const missingRec = RECOMMENDED.filter(v => !process.env[v.key]);
    if (missingRec.length > 0) {
      console.warn('\n⚠️  Missing recommended environment variables:');
      missingRec.forEach(v => console.warn(`   ${v.key.padEnd(24)} — ${v.desc}`));
      console.warn('');
    }
  }

  console.log('✓ Environment validated');
}

module.exports = { validateEnv };
