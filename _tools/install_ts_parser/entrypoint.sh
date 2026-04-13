#!/bin/bash
set -euo pipefail

# Script: install_ts_parser/scripts.sh
# Purpose: Securely download and build a Treesitter parser
# Arguments:
#   $1 - Git repository URL (parser repo)
#   $2 - Revision (commit hash, tag, or branch)
#   $3 - Output path for .so file (directory + filename)
#   $4 - Build path within repository (optional, e.g., 'tsx', 'typescript')
#
# Security measures:
#   - Strict bash settings (set -euo pipefail)
#   - Input validation on all arguments
#   - Secure temporary directory with restricted permissions
#   - Git revision validation
#   - Read-only output verification
#   - No use of shell globbing or expansion on untrusted input

# ============================================================================
# CONFIGURATION
# ============================================================================

readonly TEMP_BUILD_DIR="$(mktemp -d -t treesitter-build-XXXXXXXXXX)"
trap "rm -rf '$TEMP_BUILD_DIR'" EXIT
chmod 700 "$TEMP_BUILD_DIR"

# ============================================================================
# ARGUMENT VALIDATION
# ============================================================================

if [[ $# -lt 3 ]] || [[ $# -gt 4 ]]; then
	echo "Usage: $0 <git_repo_url> <revision> <output_path> [build_path]" >&2
	exit 1
fi

GIT_REPO="$1"
REVISION="$2"
OUTPUT_PATH="$3"
BUILD_PATH="${4:-.}" # Default to current directory if not specified

# Validate git repository URL
# Allow https://, http://, git://, ssh://, and local paths
echo "$GIT_REPO"
if ! [[ "$GIT_REPO" =~ ^(https?|git|ssh)://.*\.git$|^/.*$ ]]; then
	echo "Error: Invalid git repository URL format. Must be https://, http://, git://, ssh://, or local path" >&2
	exit 1
fi

# Validate revision (alphanumeric, hyphens, dots, underscores, slashes for refs)
if ! [[ "$REVISION" =~ ^[a-zA-Z0-9._/\-]+$ ]]; then
	echo "Error: Invalid revision format. Only alphanumeric, dots, hyphens, underscores, and slashes allowed" >&2
	exit 1
fi

# Validate build path (alphanumeric, hyphens, underscores, slashes, dots)
if ! [[ "$BUILD_PATH" =~ ^[a-zA-Z0-9._/\-]+$ ]] && [[ "$BUILD_PATH" != "." ]]; then
	echo "Error: Invalid build path format. Only alphanumeric, dots, hyphens, underscores, and slashes allowed" >&2
	exit 1
fi

# Validate output directory exists and is writable
OUTPUT_DIR=$(dirname "$OUTPUT_PATH")
if [[ -z "$OUTPUT_DIR" ]] || [[ "$OUTPUT_DIR" == "." ]]; then
	OUTPUT_DIR="."
fi

if [[ ! -d "$OUTPUT_DIR" ]]; then
	echo "Error: Output directory does not exist: $OUTPUT_DIR" >&2
	exit 1
fi

if [[ ! -w "$OUTPUT_DIR" ]]; then
	echo "Error: Output directory is not writable: $OUTPUT_DIR" >&2
	exit 1
fi

# ============================================================================
# GIT OPERATIONS
# ============================================================================

cd "$TEMP_BUILD_DIR"

echo "Cloning repository: $GIT_REPO" >&2

# Clone repository - use shallow clone to minimize bandwidth
if ! git clone --depth 1 "$GIT_REPO" parser 2>/dev/null; then
	# Fallback to full clone if shallow clone fails
	if ! git clone "$GIT_REPO" parser 2>/dev/null; then
		echo "Error: Failed to clone repository" >&2
		exit 1
	fi
fi

cd parser

# Validate and fetch the specific revision
echo "Checking out revision: $REVISION" >&2

# First, check if we already have this revision locally
if git rev-parse "$REVISION" >/dev/null 2>&1; then
	# Revision might be available but shallow repositories need special handling
	# Try to checkout first
	if git checkout "$REVISION" >/dev/null 2>&1; then
		: # Success
	else
		# Shallow repository - need to unshallow and fetch
		echo "Unshallowing repository to access full history..." >&2
		git fetch --unshallow 2>/dev/null || true
		if ! git checkout "$REVISION" >/dev/null 2>&1; then
			echo "Error: Failed to checkout revision: $REVISION" >&2
			exit 1
		fi
	fi
else
	# Revision not found, fetch it from remote
	echo "Fetching revision from remote..." >&2
	if ! git fetch --unshallow origin "$REVISION" 2>/dev/null; then
		# Try regular fetch if unshallow fails
		if ! git fetch origin "$REVISION" 2>/dev/null; then
			echo "Error: Could not fetch revision $REVISION from remote" >&2
			exit 1
		fi
	fi

	# Checkout the fetched revision
	if ! git checkout FETCH_HEAD >/dev/null 2>&1; then
		echo "Error: Failed to checkout fetched revision" >&2
		exit 1
	fi
fi

# Verify checkout succeeded
CURRENT_REF=$(git rev-parse HEAD)
echo "Checked out: $CURRENT_REF" >&2

# ============================================================================
# BUILD PARSER
# ============================================================================

echo "Building parser with tree-sitter..." >&2

if [[ ! -f "binding.gyp" ]] && [[ ! -f "src/grammar.json" ]]; then
	echo "Error: This does not appear to be a valid Treesitter parser repository" >&2
	exit 1
fi

# Change to build directory if specified
if [[ "$BUILD_PATH" != "." ]] && [[ -d "$BUILD_PATH" ]]; then
	echo "Entering build directory: $BUILD_PATH" >&2
	cd "$BUILD_PATH"
fi

# Run tree-sitter build
if ! tree-sitter build >/dev/null 2>&1; then
	echo "Error: tree-sitter build failed" >&2
	exit 1
fi

# ============================================================================
# LOCATE AND COPY .SO FILE
# ============================================================================

# Find the built .so file (usually in build/Release or similar)
SO_FILE=""

# Try specific patterns first (with glob expansion)
for candidate_path in build/Release build target/release .; do
	if [[ -d "$candidate_path" ]]; then
		while IFS= read -r candidate; do
			if [[ -f "$candidate" ]]; then
				SO_FILE="$candidate"
				break 2
			fi
		done < <(find "$candidate_path" -maxdepth 1 -name "*.so" -type f 2>/dev/null)
	fi
done

if [[ -z "$SO_FILE" ]]; then
	echo "Error: No .so file found after build" >&2
	exit 1
fi

echo "Found parser library: $SO_FILE" >&2

# Copy with verification
if ! cp "$SO_FILE" "$OUTPUT_PATH"; then
	echo "Error: Failed to copy .so file to output path" >&2
	exit 1
fi

# Verify output file exists and is readable
if [[ ! -r "$OUTPUT_PATH" ]]; then
	echo "Error: Output file is not readable: $OUTPUT_PATH" >&2
	exit 1
fi

# Verify it's actually an ELF binary
if ! file "$OUTPUT_PATH" | grep -q "ELF"; then
	echo "Error: Output file is not a valid ELF binary" >&2
	rm -f "$OUTPUT_PATH"
	exit 1
fi

echo "Successfully installed parser: $OUTPUT_PATH" >&2
echo "$OUTPUT_PATH"
