#!/bin/bash
set -euo pipefail

# Script: install_ts_parser/install.sh
# Purpose: Wrapper script to install tree-sitter parsers for multiple languages
# Arguments:
#   $1 - Language name (go, typescript, python, rust, etc.)
#   $2 - Output directory (optional, defaults to ./parsers)
#
# This script manages language-specific parser configurations and calls
# the entrypoint.sh script with the appropriate arguments.

# ============================================================================
# CONFIGURATION
# ============================================================================

# Language-specific parser configurations
# Format: LANG_NAME: "REPO_URL|REVISION|BUILD_PATH"
# BUILD_PATH is optional - defaults to '.' (root) if not specified
declare -A PARSER_CONFIG=(
  [go]="https://github.com/tree-sitter/tree-sitter-go.git|1547678a9da59885853f5f5cc8a99cc203fa2e2c|."
  [bash]="https://github.com/tree-sitter/tree-sitter-bash.git|5d8a33249511ed8bcf6cf135b7b2a815c7a02d9b|."
  [typescript]="https://github.com/tree-sitter/tree-sitter-typescript.git|75b3874edb2dc714fb1fd77a32013d0f8699989f|typescript"
)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_DIR="${2:-.}"
DOCKER_IMAGE_NAME="tree-sitter-parser-builder:latest"
CONTAINER_OUTPUT_DIR="/output"

# ============================================================================
# USAGE AND VALIDATION
# ============================================================================

usage() {
  echo "Usage: $0 <language|all> [output_directory]" >&2
  echo "" >&2
  echo "Supported languages:" >&2
  for lang in "${!PARSER_CONFIG[@]}"; do
    echo "  - $lang" >&2
  done | sort
  echo "  - all     # Install all language parsers" >&2
  echo "" >&2
  echo "Examples:" >&2
  echo "  $0 go                              # Install Go parser to ./parsers" >&2
  echo "  $0 typescript /usr/local/parsers   # Install TypeScript parser to /usr/local/parsers" >&2
  echo "  $0 all                             # Install all parsers to ./parsers" >&2
  echo "  $0 all /usr/local/parsers          # Install all parsers to /usr/local/parsers" >&2
  exit 1
}

if [[ $# -lt 1 ]]; then
  usage
fi

LANGUAGE="${1,,}" # Convert to lowercase

# Handle 'all' keyword
if [[ "$LANGUAGE" == "all" ]]; then
  echo "Installing all tree-sitter language parsers..." >&2
  echo "" >&2

  FAILED_LANGS=()
  INSTALLED_COUNT=0

  # Disable 'set -e' for the loop to allow handling of individual
  # language installation failures without exiting the entire script
  set +e

  # Get list of languages and install each one
  mapfile -t langs < <(printf '%s\n' "${!PARSER_CONFIG[@]}" | sort)

  for lang in "${langs[@]}"; do
    echo "Installing parser for: $lang" >&2
    "$SCRIPT_DIR/install.sh" "$lang" "${2:-.}"
    if [[ $? -eq 0 ]]; then
      ((INSTALLED_COUNT++))
    else
      FAILED_LANGS+=("$lang")
    fi
  done

  # Re-enable strict error handling for the rest of the script
  set -e

  echo "Installation summary:" >&2
  echo "  Successfully installed: $INSTALLED_COUNT/${#PARSER_CONFIG[@]}" >&2

  if [[ ${#FAILED_LANGS[@]} -gt 0 ]]; then
    echo "  Failed installations:" >&2
    for lang in "${FAILED_LANGS[@]}"; do
      echo "    - $lang" >&2
    done
    exit 1
  fi

  exit 0
fi

# Validate language
if [[ ! -v PARSER_CONFIG[$LANGUAGE] ]]; then
  echo "Error: Unknown language '$LANGUAGE'" >&2
  echo "" >&2
  usage
fi

# ============================================================================
# CREATE OUTPUT DIRECTORY
# ============================================================================

if [[ ! -d "$OUTPUT_DIR" ]]; then
  echo "Creating output directory: $OUTPUT_DIR" >&2
  mkdir -p "$OUTPUT_DIR"
fi

if [[ ! -w "$OUTPUT_DIR" ]]; then
  echo "Error: Output directory is not writable: $OUTPUT_DIR" >&2
  exit 1
fi

# ============================================================================
# BUILD DOCKER IMAGE
# ============================================================================

echo "Building Docker image for tree-sitter parser builder..." >&2

if ! docker build -t "$DOCKER_IMAGE_NAME" "$SCRIPT_DIR" >/dev/null 2>&1; then
  echo "Error: Failed to build Docker image" >&2
  echo "Run 'docker build -t $DOCKER_IMAGE_NAME $SCRIPT_DIR' for detailed error output" >&2
  exit 1
fi

# ============================================================================
# PARSE CONFIGURATION AND RUN CONTAINER
# ============================================================================

IFS='|' read -r GIT_REPO REVISION BUILD_PATH <<<"${PARSER_CONFIG[$LANGUAGE]}"

# Default BUILD_PATH to '.' if not specified
BUILD_PATH="${BUILD_PATH:-.}"

# Determine output filename based on language
OUTPUT_FILE="$OUTPUT_DIR/${LANGUAGE}.so"

echo "Installing tree-sitter parser for: $LANGUAGE" >&2
echo "Repository: $GIT_REPO" >&2
echo "Revision: $REVISION" >&2
echo "Build path: $BUILD_PATH" >&2
echo "Output: $OUTPUT_FILE" >&2
echo "" >&2

# ============================================================================
# RUN CONTAINER AND COPY OUTPUT
# ============================================================================

# Create a temporary container name based on language and timestamp
CONTAINER_NAME="tree-sitter-build-${LANGUAGE}-$$"

# Run the container with the entrypoint script and arguments
# The container will execute the build and place output in $CONTAINER_OUTPUT_DIR
if ! docker run --rm \
  --name "$CONTAINER_NAME" \
  -v "$OUTPUT_DIR:$CONTAINER_OUTPUT_DIR" \
  "$DOCKER_IMAGE_NAME" \
  "$GIT_REPO" "$REVISION" "$CONTAINER_OUTPUT_DIR/${LANGUAGE}.so" "$BUILD_PATH" >/dev/null 2>&1; then
  echo "Error: Container build failed" >&2
  echo "Run the command below to see detailed error output:" >&2
  echo "  docker run --rm -v '$OUTPUT_DIR:$CONTAINER_OUTPUT_DIR' '$DOCKER_IMAGE_NAME' \\\"$GIT_REPO\\\" \\\"$REVISION\\\" \\\"$CONTAINER_OUTPUT_DIR/${LANGUAGE}.so\\\" \\\"$BUILD_PATH\\\"" >&2
  exit 1
fi

echo "" >&2
echo "Successfully installed $LANGUAGE parser to: $OUTPUT_FILE" >&2
