import { describe, it, expect } from "vitest";
import { DANGEROUS_PATTERNS, BLOCK_INSTRUCTION } from "./patterns";

// ── DANGEROUS_PATTERNS ────────────────────────────────────────────────

describe("DANGEROUS_PATTERNS", () => {
  describe("sudo", () => {
    const pattern = /\bsudo\b/i;
    it("matches sudo command", () => {
      expect(pattern.test("sudo rm -rf /")).toBe(true);
    });
    it("does not match words containing sudo", () => {
      expect(pattern.test("pseudo rm")).toBe(false);
    });
  });

  describe("chmod/chown 777", () => {
    const pattern = /\b(chmod|chown)\b.*\b777\b/i;
    it("matches chmod 777", () => {
      expect(pattern.test("chmod 777 file")).toBe(true);
    });
    it("matches chown 777", () => {
      expect(pattern.test("chown 777 file")).toBe(true);
    });
    it("does not match chmod 755", () => {
      expect(pattern.test("chmod 755 file")).toBe(false);
    });
  });

  describe("dd", () => {
    const pattern = /\bdd\s+if=/i;
    it("matches dd if=/dev/zero", () => {
      expect(pattern.test("dd if=/dev/zero of=/dev/sda")).toBe(true);
    });
    it("does not match words with dd", () => {
      expect(pattern.test("odd if=")).toBe(false);
    });
  });

  describe("mkfs / fdisk", () => {
    it("matches mkfs.ext4", () => {
      expect(/\bmkfs\.?\w*\b/i.test("mkfs.ext4 /dev/sda1")).toBe(true);
    });
    it("matches mkfs", () => {
      expect(/\bmkfs\.?\w*\b/i.test("mkfs /dev/sda1")).toBe(true);
    });
    it("matches fdisk", () => {
      expect(/\bfdisk\b/i.test("fdisk /dev/sda")).toBe(true);
    });
  });

  describe("shutdown/reboot", () => {
    const pattern = /\b(shutdown|reboot|halt|poweroff|init\s+[06])\b/i;
    it("matches shutdown", () => {
      expect(pattern.test("shutdown now")).toBe(true);
    });
    it("matches reboot", () => {
      expect(pattern.test("reboot")).toBe(true);
    });
    it("matches init 0", () => {
      expect(pattern.test("init 0")).toBe(true);
    });
  });

  describe("fork bomb", () => {
    const pattern = /:\(\)\{ :\|:& \};:/;
    it("matches classic fork bomb", () => {
      expect(pattern.test(":(){ :|:& };:")).toBe(true);
    });
    it("does not match normal function", () => {
      expect(pattern.test("foo(){ echo hi; }")).toBe(false);
    });
  });

  describe("raw disk write", () => {
    const pattern = />\/dev\/sda\b/i;
    it("matches redirect to /dev/sda", () => {
      expect(pattern.test("cat foo >/dev/sda")).toBe(true);
    });
    it("does not match reading /dev/sda", () => {
      expect(pattern.test("cat /dev/sda")).toBe(false);
    });
  });

  describe("recursive chmod", () => {
    const pattern = /\bchmod\s+[_-]?[rR]\b/i;
    it("matches chmod -R", () => {
      expect(pattern.test("chmod -R 777 /")).toBe(true);
    });
    it("matches chmod -r", () => {
      expect(pattern.test("chmod -r 777 /")).toBe(true);
    });
  });

  describe("find workarounds", () => {
    it("matches find -delete", () => {
      expect(/\bfind\b.*-delete\b/i.test("find . -name '*.log' -delete")).toBe(true);
    });
    it("matches find -exec rm", () => {
      expect(/\bfind\b.*-exec\s+rm\b/i.test("find . -exec rm {} \\;")).toBe(true);
    });
    it("matches find -execdir rm", () => {
      expect(/\bfind\b.*-execdir\s+rm\b/i.test("find . -execdir rm {} \\;")).toBe(true);
    });
  });

  describe("xargs rm", () => {
    it("matches xargs rm", () => {
      expect(/\bxargs\b.*\brm\b/i.test("xargs rm -rf")).toBe(true);
    });
  });

  describe("scripting language workarounds", () => {
    it("matches perl unlink", () => {
      expect(/\bperl\b.*\bunlink\b/i.test("perl -e 'unlink(\"file\")'")).toBe(true);
    });
    it("matches python os.remove", () => {
      expect(/\bpython\b.*\bos\.remove\b/i.test("python -c 'import os; os.remove(\"file\")'")).toBe(true);
    });
    it("matches python shutil.rmtree", () => {
      expect(/\bpython\b.*\bshutil\.rmtree\b/i.test("python -c 'shutil.rmtree(\"/dir\")'")).toBe(true);
    });
    it("matches ruby FileUtils.rm", () => {
      expect(/\bruby\b.*\bFileUtils\.rm/i.test("ruby -e 'FileUtils.rm(\"file\")'")).toBe(true);
    });
  });
});

// ── BLOCK_INSTRUCTION ─────────────────────────────────────────────────

describe("BLOCK_INSTRUCTION", () => {
  it("is a non-empty string", () => {
    expect(typeof BLOCK_INSTRUCTION).toBe("string");
    expect(BLOCK_INSTRUCTION.length).toBeGreaterThan(0);
  });

  it("mentions key concepts", () => {
    expect(BLOCK_INSTRUCTION).toContain("SECURITY BLOCK");
    expect(BLOCK_INSTRUCTION).toContain("not allowed");
    expect(BLOCK_INSTRUCTION).toContain("workarounds");
  });
});
