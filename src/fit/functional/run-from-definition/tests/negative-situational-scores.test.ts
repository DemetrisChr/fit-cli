/**
 * Tests for failing a situational run on a negative Scorer score. Real filesystem and
 * real spawned `find`/`cat`, so the host-side listing is exercised as it runs locally.
 *
 * Run on their own:
 *   node --import tsx --test src/fit/functional/run-from-definition/tests/negative-situational-scores.test.ts
 */
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { capture } from "../../../../util/non-fit/proc.js";
import {
  findNegativeSituationalScores,
  formatNegativeScoresMessage,
  type ScoresReader,
} from "../run-from-definition.js";

const realReader: ScoresReader = {
  pathExists: (path) => Promise.resolve(existsSync(path)),
  capture: (command, args, cwd, opts) => capture(command, args, cwd, opts),
};

/** Lay out <base>/results/<runDir>/scores.json5 for each entry; undefined writes no scores file. */
function writeResults(runs: Record<string, string | undefined>): { base: string; resultsDir: string } {
  const base = mkdtempSync(join(tmpdir(), "fit-scores-"));
  const resultsDir = join(base, "results");
  for (const [runDir, scores] of Object.entries(runs)) {
    mkdirSync(join(resultsDir, runDir), { recursive: true });
    writeFileSync(join(resultsDir, runDir, "run.json5"), "{}");
    if (scores !== undefined) writeFileSync(join(resultsDir, runDir, "scores.json5"), scores);
  }
  return { base, resultsDir };
}

test("findNegativeSituationalScores returns only runs scored below zero", async () => {
  const { base, resultsDir } = writeResults({
    aaaaaaaa: JSON.stringify({ score: -30, reasons: ["-30 for 3 SDK errors"], errors: { sdk: 3, server: 0 } }),
    bbbbbbbb: JSON.stringify({ score: 0, reasons: [] }),
    cccccccc: JSON.stringify({ score: 12, reasons: ["12 for fast recovery"] }),
  });
  try {
    assert.deepEqual(await findNegativeSituationalScores(realReader, resultsDir), [
      { runDir: "aaaaaaaa", score: -30, reasons: ["-30 for 3 SDK errors"] },
    ]);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("findNegativeSituationalScores treats an unscored run and a missing scores file as not negative", async () => {
  const { base, resultsDir } = writeResults({
    aaaaaaaa: JSON.stringify({ reasons: ["Not applicable: no situation was executed during this run."] }),
    bbbbbbbb: undefined,
  });
  try {
    assert.deepEqual(await findNegativeSituationalScores(realReader, resultsDir), []);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("findNegativeSituationalScores catches the Scorer's own -100 'failed to score' result", async () => {
  const { base, resultsDir } = writeResults({
    aaaaaaaa: JSON.stringify({ score: -100, reasons: ["Score unknown. Failed to score run: boom"] }),
  });
  try {
    const negatives = await findNegativeSituationalScores(realReader, resultsDir);
    assert.equal(negatives.length, 1);
    assert.equal(negatives[0]?.score, -100);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("findNegativeSituationalScores skips an unparseable scores file and a missing results dir", async () => {
  const { base, resultsDir } = writeResults({
    aaaaaaaa: "{not json",
    bbbbbbbb: JSON.stringify({ score: -5, reasons: [] }),
  });
  try {
    assert.deepEqual(await findNegativeSituationalScores(realReader, resultsDir), [
      { runDir: "bbbbbbbb", score: -5, reasons: [] },
    ]);
    assert.deepEqual(await findNegativeSituationalScores(realReader, join(base, "absent")), []);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("formatNegativeScoresMessage lists each run's score and reasons", () => {
  assert.equal(
    formatNegativeScoresMessage([
      { runDir: "aaaaaaaa", score: -30, reasons: ["-20 for slow recovery", "-10 for 1 SDK error"] },
      { runDir: "bbbbbbbb", score: -1, reasons: [] },
    ]),
    "Situational run scored below zero, though its tests passed:\n" +
      "  aaaaaaaa: score -30\n    -20 for slow recovery\n    -10 for 1 SDK error\n" +
      "  bbbbbbbb: score -1",
  );
});
