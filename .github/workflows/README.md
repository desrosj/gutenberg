# WordPress 5.1 continuous integration

These workflows replace the branch's Travis CI configuration. They run on pull requests targeting `wp/5.1`, pushes to `wp/5.1`, and manual dispatches. Every WordPress installation and PHPUnit test-suite download is pinned to WordPress **5.1**, including both Docker web sites. Forks run the same checks.

| Travis job | GitHub Actions equivalent |
| --- | --- |
| `npm install` and `npm run ci` | `static-checks.yml`: existing license checks and package builds during installation, JavaScript/CSS/package linting, JavaScript unit tests, and generated-documentation/lockfile checks; also runs the production build. |
| `DOCKER=true` PHP tests | `unit-test.yml`: the original PHP 7.1.5/PHPUnit 6.0.13 image, production build, generated-parser check, parser syntax check, PHP coding standards, and single-site/multisite tests. |
| PHP 5.6, outside pull requests | `unit-test.yml`: PHP 5.6 and PHPUnit 4.8.36, single-site/multisite tests, build and parser checks, on pushes and manual dispatches. |
| PHP 5.3, outside pull requests | `unit-test.yml`: PHP 5.3 and PHPUnit 4.8.36, with the same checks and event restrictions as PHP 5.6. |
| `POPULAR_PLUGINS=true` | `end2end-test.yml`: administrator tests with Advanced Custom Fields, Jetpack, and WPForms Lite. |
| `E2E_ROLE=author` | `end2end-test.yml`: author tests using the original `author`/`authpass` credentials. |
| PHP 5.2 | Not migrated; see the limitation below. |

## Legacy environment

The workflows use the branch's `.nvmrc` (Node.js 10) and its existing npm, Composer, Jest, Puppeteer, PHPUnit, and Docker Compose configuration. They add no package dependencies and do not change either lockfile. The Actions runtime is separate from the Node.js version used to build and test Gutenberg.

The shared Node setup replaces GitHub's retired `git://` transport with HTTPS for the existing Git dependency. It retains the npm version bundled with Node.js 10 instead of running the old setup script's incompatible `npm install npm -g` command. Installation still runs the existing license checks and package build hooks.

The shared WordPress setup calls `bin/install-docker.sh` directly, avoiding the interactive nvm setup and npm upgrade in `bin/setup-local-env.sh`. A command adapter uses the runner's Docker Compose with the existing scripts and npm commands, preserves underscore-separated container names, and consistently applies the CI image overrides. Docker images are pinned by digest. The web images provide PHP 7.1 and the setup script explicitly downloads WordPress 5.1, since even the old `5.1` image tag contains 5.1.1. Composer stays on major version 1 with PHP 7 because the lockfile requires that plugin API and PHP range. The CLI retains its original version; only its bundled CA certificates and the test sites' CA certificates are refreshed from the runner's trust store, keeping TLS verification enabled. Popular-plugin fixtures use WordPress 5.1-era releases; their current releases require newer WordPress/PHP versions. The optional version environment variables preserve existing local defaults.

The workflows follow trunk's explicit runner versions, commit-pinned actions, job-level read-only permissions, disabled checkout credentials, timeouts, and cancellation of superseded pull-request runs. Independent test configurations do not cancel one another when a matrix entry fails. Docker failures print container logs, and cleanup runs even after test failures.

## PHP 5.2 limitation

Full Travis coverage is not currently reproduced: the PHP 5.2 job is absent. The PHP setup action used by trunk supports PHP 5.3 and newer. This branch's PHP 5.2 path builds PHP 5.2.17 and PHPUnit 3.6 using phpbrew on Ubuntu Trusty, with patches and system libraries specific to that environment; it cannot be transferred unchanged to the supported GitHub-hosted runner. Substituting the existing PHP 7.1 Docker image would not test PHP 5.2 compatibility.

Restoring this job requires a separately validated PHP 5.2 environment, such as a maintained self-hosted runner or a compatible legacy build image. This migration does not introduce a new toolchain or silently replace that coverage with a newer PHP version. The original `bin/install-php-phpunit.sh` and its patches remain available for that follow-up.
