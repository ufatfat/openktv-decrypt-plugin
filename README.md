# OpenKTV Decrypt Plugin

OpenKTV 的跨平台 QQ 音乐 QMC 解密插件。项目使用纯 Node.js 实现，在 macOS、Windows 和 Linux 上使用同一套内核，不依赖 QQMusic 进程、Windows DLL 或额外的可执行文件。

> 请仅处理自己拥有合法使用权的媒体文件。本项目不提供歌曲、密钥或在线取钥服务。

## 参考项目

本项目参考并移植了 MIT 许可项目 [Afle520/music-geshizhuanhuan](https://github.com/Afle520/music-geshizhuanhuan) 中的 QMC 格式与密码算法实现：

- [QMC 尾包解析与本地 EKey 数据库查询](https://github.com/Afle520/music-geshizhuanhuan/blob/main/music_unlock/formats/qmc.py)
- [QMC v1/v2、Tencent TEA、Map 和 RC4 算法](https://github.com/Afle520/music-geshizhuanhuan/blob/main/music_unlock/ciphers.py)
- [原项目 MIT License](https://github.com/Afle520/music-geshizhuanhuan/blob/main/LICENSE)

原项目许可证副本保存在 [`vendor/music-geshizhuanhuan.LICENSE.md`](vendor/music-geshizhuanhuan.LICENSE.md)。本仓库的 JavaScript 接口、流式文件处理、OpenKTV 插件适配和命令行工具按本仓库的 MIT License 发布。

## 能力

- QMC v1 128 字节静态密钥。
- QMC v2 Map Cipher 和分段 RC4。
- PcV1Legacy EKey 与双层 EKey。
- STag、QTag、PcV1Legacy、MusicEx 尾包。
- 从 QQ 音乐安卓端 `player_process_db` 按原文件名、MID、资源 ID 或媒体文件名查找 EKey。
- 流式转换，不会把整首歌曲一次载入内存。
- 输出前识别真实的 FLAC、MP3、OGG、M4A 或 WAV 容器。
- 原文件始终保留；失败时删除临时文件，不发布伪音频。

## 环境要求

- Node.js 22.5 或更高版本。
- 不需要安装 npm 依赖。

## 命令行使用

```bash
git clone git@github.com:ufatfat/openktv-decrypt-plugin.git
cd openktv-decrypt-plugin

node ./bin/openktv-decrypt.mjs ./song.qmcflac
node ./bin/openktv-decrypt.mjs ./song.mgg --ekey-db /absolute/path/to/player_process_db
node ./bin/openktv-decrypt.mjs ./song.mgg --ekey 'your-ekey'
```

默认输出到源文件旁边，并根据解密后的真实容器选择扩展名。也可以指定输出路径：

```bash
node ./bin/openktv-decrypt.mjs ./song.mgg -o ./song.ogg --ekey-db ./player_process_db
```

如果目标文件已经存在，工具不会覆盖。明确需要覆盖时添加 `--overwrite`。

也可以用环境变量传入密钥配置：

```bash
OPENKTV_QMC_EKEY_DB=/absolute/path/to/player_process_db \
  node ./bin/openktv-decrypt.mjs ./song.mgg

OPENKTV_QMC_EKEY='your-ekey' \
  node ./bin/openktv-decrypt.mjs ./song.mgg
```

不要把真实 EKey 或 `player_process_db` 提交到 Git。

## MusicEx 与 STag

新版 MusicEx 和 STag 文件通常不携带 EKey。插件可以解析其中的 MID、资源 ID 和内部媒体文件名，但必须另外提供：

1. QQ 音乐安卓端 `player_process_db`，推荐；或
2. 与该文件对应的 EKey。

缺少密钥时插件会返回明确错误，不会尝试用静态密钥生成无效音频。

## 作为 JavaScript 模块使用

```js
import { decodeQmcFile } from "openktv-decrypt-plugin";

const result = decodeQmcFile("song.mgg", "song.ogg.tmp", {
  ekeyDbPath: "/absolute/path/to/player_process_db",
});

console.log(result.container, result.footerKind, result.bytesWritten);
```

`decodeQmcFile` 要求输出路径尚不存在。调用方应先写临时文件，验证 `result.container` 后再原子重命名。

## 作为 OpenKTV 插件使用

```js
import { createQmcDecodeConverter } from "openktv-decrypt-plugin/openktv-plugin";

const converter = createQmcDecodeConverter();
registry.register(converter);
```

插件工厂读取 `OPENKTV_QMC_EKEY` 和 `OPENKTV_QMC_EKEY_DB`，并实现 OpenKTV 媒体转换器的 `availability`、`outputPath`、`validateOutput` 和 `convertBatch` 接口。

## 支持的输入

- QMC v2：`.mflac`、`.mflac0`、`.mgg`、`.mgg0`、`.mgg1`、`.mggl`、`.mmp4`、`.qmcflac`、`.qmcogg`、`.qmc0`、`.qmc2`、`.qmc3`、`.qmc4`、`.qmc6`、`.qmc8`
- QMC v1：`.tkm`、`.bkcmp3`、`.bkcm4a`、`.bkcflac`、`.bkcwav`、`.bkcape`、`.bkcogg`、`.bkcwma` 以及常见十六进制扩展名

当前只发布浏览器和 OpenKTV 可直接使用的 FLAC、MP3、OGG、M4A 与 WAV 输出。无法识别或不支持的输出容器会被拒绝。

## 测试

```bash
npm test
npm run check
```

测试覆盖 QMC v1、Map/RC4 分段流、单层/双层 EKey 参考向量和 MusicEx 尾包解析。
