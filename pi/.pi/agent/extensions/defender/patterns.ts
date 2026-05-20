/**
 * Defender Patterns
 *
 * Constants and regex patterns for the defender extension.
 * Separated from execution logic for testability and single-responsibility.
 */

/** Patterns for dangerous bash commands and common workarounds. */
export const DANGEROUS_PATTERNS: RegExp[] = [
  /\bsudo\b/i,
  /\b(chmod|chown)\b.*\b777\b/i,
  /\bdd\s+if=/i,
  /\bmkfs\.?\w*\b/i,
  /\bfdisk\b/i,
  /\b(shutdown|reboot|halt|poweroff|init\s+[06])\b/i,
  /:\(\)\{ :\|:& \};:/, // fork bomb (escape parens/braces)
  />\/dev\/sda\b/i, // write to raw disk (no \b — ">" is non-word)
  /\bchmod\s+[_-]?[rR]\b/i, // recursive chmod
  /\bfind\b.*-delete\b/i, // find ... -delete (\B before "-" — hyphen is non-word)
  /\bfind\b.*-exec\s+rm\b/i, // find ... -exec rm ...
  /\bfind\b.*-execdir\s+rm\b/i, // find ... -execdir rm ...
  /\bxargs\b.*\brm\b/i, // xargs rm
  /\bperl\b.*\bunlink\b/i, // perl unlink
  /\bpython\b.*\bos\.remove\b/i, // python os.remove
  /\bpython\b.*\bshutil\.rmtree\b/i, // python shutil.rmtree
  /\bruby\b.*\bFileUtils\.rm/i, // ruby FileUtils.rm
];

/** Message sent to the agent when a dangerous command is blocked. */
export const BLOCK_INSTRUCTION =
  "SECURITY BLOCK: Your last action was blocked because it is destructive or dangerous. " +
  "DO NOT attempt any workarounds (find, xargs, perl, python, ruby, or any other tool). " +
  "Just tell the user: 'This operation is not allowed because it could harm the system.'";
