/** @type {import('pm2').StartOptions} */
module.exports = {
	apps: [
		{
			name: 'colorlab-fe',
			cwd: './fe',
			script: 'build/index.js',
			instances: 1,
			exec_mode: 'fork',
			autorestart: true,
			watch: false,
			max_memory_restart: '512M',
			env: {
				NODE_ENV: 'production',
				PORT: 5001,
				HOST: '0.0.0.0',
				ORIGIN: 'http://localhost:5001'
			}
		}
	]
};
