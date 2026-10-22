import { describe, it, expect } from "vitest";
import { applyKey, score, initialState } from "../src/commands/type.js";

const typeAll = (target: string, keys: string) =>
  [...keys].reduce((s, k) => applyKey(s, target, k), initialState());

describe("applyKey", () => {
  it("appends characters and counts wrong ones as errors", () => {
    const s = typeAll("abc", "axc");
    expect(s.typed).toBe("axc");
    expect(s.keystrokes).toBe(3);
    expect(s.errors).toBe(1);
  });

  it("removes the last character on backspace without counting a keystroke", () => {
    const s = applyKey(typeAll("abc", "ax"), "abc", "\x7f");
    expect(s.typed).toBe("a");
    expect(s.keystrokes).toBe(2);
  });

  it("auto-fills indentation after a correct newline", () => {
    const s = typeAll("a\n  b", "a\r");
    expect(s.typed).toBe("a\n  ");
  });

  it("ignores input past the end of the target", () => {
    expect(typeAll("ab", "abc").typed).toBe("ab");
  });

  it("does not mutate the previous state", () => {
    const before = initialState();
    applyKey(before, "a", "a");
    expect(before.typed).toBe("");
  });
});

describe("score", () => {
  it("counts 5 correct characters as one word", () => {
    const s = typeAll("hello world", "hello world");
    expect(score("hello world", s, 60_000).wpm).toBeCloseTo(11 / 5);
    expect(score("hello world", s, 60_000).accuracy).toBe(100);
  });

  it("only counts characters that match the target toward wpm", () => {
    const s = typeAll("abcde", "abxde");
    expect(score("abcde", s, 60_000).wpm).toBeCloseTo(4 / 5);
    expect(score("abcde", s, 60_000).accuracy).toBe(80);
  });
});
