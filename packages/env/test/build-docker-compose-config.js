/**
 * Internal dependencies
 */
const buildDockerComposeConfig = require( '../lib/build-docker-compose-config' );

// The basic config keys which build docker compose config requires.
const CONFIG = {
	mappings: {},
	pluginSources: [],
	themeSources: [],
	port: 8888,
	testsPort: 8889,
	configDirectoryPath: '/path/to/config',
};

describe( 'buildDockerComposeConfig', () => {
	it( 'should map directories before individual sources', () => {
		const envConfig = {
			...CONFIG,
			mappings: {
				'wp-content/plugins': {
					path: '/path/to/wp-plugins',
				},
			},
			pluginSources: [
				{ path: '/path/to/local/plugin', basename: 'test-name' },
			],
		};
		const dockerConfig = buildDockerComposeConfig( envConfig );
		const { volumes } = dockerConfig.services.wordpress;
		expect( volumes ).toEqual( [
			'wordpress:/var/www/html', // WordPress root
			'/path/to/wp-plugins:/var/www/html/wp-content/plugins', // Mapped plugins root
			'/path/to/local/plugin:/var/www/html/wp-content/plugins/test-name', // Mapped plugin
		] );
	} );

	it( 'should add all specified sources to tests, dev, and cli services', () => {
		const envConfig = {
			...CONFIG,
			mappings: {
				'wp-content/plugins': {
					path: '/path/to/wp-plugins',
				},
			},
			pluginSources: [
				{ path: '/path/to/local/plugin', basename: 'test-name' },
			],
			themeSources: [
				{ path: '/path/to/local/theme', basename: 'test-theme' },
			],
		};
		const dockerConfig = buildDockerComposeConfig( envConfig );
		const devVolumes = dockerConfig.services.wordpress.volumes;
		const cliVolumes = dockerConfig.services.cli.volumes;
		expect( devVolumes ).toEqual( cliVolumes );

		const testsVolumes = dockerConfig.services[ 'tests-wordpress' ].volumes;
		const testsCliVolumes = dockerConfig.services[ 'tests-cli' ].volumes;
		expect( testsVolumes ).toEqual( testsCliVolumes );

		const localSources = [
			'/path/to/wp-plugins:/var/www/html/wp-content/plugins',
			'/path/to/local/plugin:/var/www/html/wp-content/plugins/test-name',
			'/path/to/local/theme:/var/www/html/wp-content/themes/test-theme',
		];

		expect( devVolumes ).toEqual( expect.arrayContaining( localSources ) );
		expect( testsVolumes ).toEqual(
			expect.arrayContaining( localSources )
		);
	} );

	it( 'should let Docker Compose choose the MariaDB version from WP_ENV_MARIADB_VERSION', () => {
		const dockerConfig = buildDockerComposeConfig( CONFIG );

		expect( dockerConfig.services.mysql.image ).toBe(
			'mariadb:${WP_ENV_MARIADB_VERSION:-latest}'
		);
	} );

	it( 'should add healthcheck to the mysql service', () => {
		const config = buildDockerComposeConfig( CONFIG );

		expect( config.services.mysql.healthcheck ).toEqual( {
			test: [
				'CMD',
				'healthcheck.sh',
				'--connect',
				'--innodb_initialized',
			],
			interval: '5s',
			timeout: '10s',
			retries: 12,
			start_period: '60s',
		} );

		// Verify MARIADB_AUTO_UPGRADE is set for existing installations
		expect( config.services.mysql.environment.MARIADB_AUTO_UPGRADE ).toBe(
			'1'
		);
	} );

	it( 'should use service_healthy condition for WordPress depends_on', () => {
		const config = buildDockerComposeConfig( CONFIG );

		expect( config.services.wordpress.depends_on ).toEqual( {
			mysql: { condition: 'service_healthy' },
		} );
		expect( config.services[ 'tests-wordpress' ].depends_on ).toEqual( {
			mysql: { condition: 'service_healthy' },
		} );
	} );
} );
