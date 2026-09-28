#!/usr/bin/env node
import { existsSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { decodeQmcFile } from "../src/qmc-codec.mjs";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: "string", short: "o" },
    ekey: { type: "string" },
    "ekey-db": { type: "string" },
    overwrite: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

function usage() {
  console.log(`OpenKTV QMC decrypt plugin

Usage:
  openktv-decrypt <input> [-o output] [--ekey value] [--ekey-db path] [--overwrite]

Environment:
  OPENKTV_QMC_EKEY       Manual EKey for MusicEx/STag files
  OPENKTV_QMC_EKEY_DB    Android QQ Music player_process_db path`);
}

if (values.help) {
  usage();
  process.exit(0);
}

if (positionals.length !== 1) {
  usage();
  process.exitCode = 2;
} else {
  const sourcePath = resolve(positionals[0]);
  const temporaryPath = join(dirname(sourcePath), `.${basename(sourcePath)}.openktv-${process.pid}.tmp`);
  try {
    if (!existsSync(sourcePath)) throw new Error(`输入文件不存在：${sourcePath}`);
    rmSync(temporaryPath, { force: true });
    const decoded = decodeQmcFile(sourcePath, temporaryPath, {
      ekey: values.ekey || process.env.OPENKTV_QMC_EKEY || "",
      ekeyDbPath: values["ekey-db"] || process.env.OPENKTV_QMC_EKEY_DB || "",
    });
    if (!decoded.container || decoded.container === "bin") throw new Error("解码结果不是支持的音频容器");
    const outputPath = values.output
      ? resolve(values.output)
      : sourcePath.slice(0, -extname(sourcePath).length) + `.${decoded.container}`;
    const outputExtension = extname(outputPath).slice(1).toLowerCase();
    if (outputExtension !== decoded.container) {
      throw new Error(`解码结果为 ${decoded.container.toUpperCase()}，输出扩展名必须为 .${decoded.container}`);
    }
    if (existsSync(outputPath) && !values.overwrite) throw new Error(`输出文件已存在：${outputPath}；如需覆盖请添加 --overwrite`);
    if (values.overwrite) rmSync(outputPath, { force: true });
    renameSync(temporaryPath, outputPath);
    console.log(outputPath);
  } catch (error) {
    rmSync(temporaryPath, { force: true });
    console.error(error instanceof Error ? error.message : "转换失败");
    process.exitCode = 1;
  }
}
