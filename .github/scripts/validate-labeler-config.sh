#!/bin/bash
#
# Validates that every package in packages/ has a corresponding entry
# in .github/labeler.yml.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LABELER_CONFIG="$REPO_ROOT/.github/labeler.yml"

missing=()

for pkg_dir in "$REPO_ROOT"/packages/*/; do
	# Skip directories without a package.json (not real packages)
	if [ ! -f "$pkg_dir/package.json" ]; then
		continue
	fi

	pkg_name="$(basename "$pkg_dir")"

	# Check that the labeler config references this package's glob
	if ! grep -q "packages/${pkg_name}/\*\*" "$LABELER_CONFIG"; then
		missing+=("$pkg_name")
	fi
done

if [ ${#missing[@]} -gt 0 ]; then
	echo "The following packages are missing from .github/labeler.yml:"
	for pkg in "${missing[@]}"; do
		echo "  - packages/$pkg"
	done
	echo ""
	echo "Add a labeling rule for each missing package to .github/labeler.yml."
	exit 1
fi

echo "All packages have labeler config entries."
