module.exports = {
  apps: [
    {
      name: 'oxidrop-signaling',
      script: './src/index.js',
      // Cluster mode to scale across available CPU cores
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '800M', // Prevent memory leaks from crash-locking resources
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        CORS_ORIGIN: '*' // Restrict this to your domain in production (e.g. 'https://oxidrop.example.com')
      }
    }
  ]
};
