#!/bin/sh
set -e

# WordPress and WP-CLI ship their own CA bundles. Keep certificate verification
# enabled when these legacy releases download the existing plugin fixtures.
if [ -w /var/www/html/wp-includes/certificates/ca-bundle.crt ]; then
	cp /gutenberg-ci/ca.pem /var/www/html/wp-includes/certificates/ca-bundle.crt
fi
exec docker-entrypoint.sh "$@"
