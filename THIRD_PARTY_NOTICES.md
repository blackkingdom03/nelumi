# Sources and modifications

nelumi is an independently maintained derivative of DeskCal, not an official upstream release.

## DeskCal

- Source: https://github.com/kangkangStudent/DeskCal
- Version: 0.5.0, commit `1f266584a56ce3b8dd8f0570cf742ce272d41c8b`
- License: MIT; complete license and copyright are preserved in `LICENSE`.
- Reused: original desktop application, Chinese calendar, schedule/recurrence/reminder engines, storage and interactions.
- Modified: appearance and themes, navigation and search, local notice extraction and OCR, source-text highlighting/editing, notes, recurring birthdays, day-count popovers, undo/redo, calendar-data verification, portable startup/profile and packaging, tests and documentation.

## neisme Calendar

- Source: https://github.com/dikafryo/neisme-Calendar
- Reference commit: `edcdd9b9dbf47efd727d4f5d77a6ada8204870ae`
- Scope: visual reference and adapted light/dark palette, rounded date cards, translucent surfaces, and lower agenda layout. No calendar engine, holiday feeds, cloud integrations, logos or wallpaper assets copied.
- License: MIT, reproduced below.

MIT License

Copyright (c) 2026 디카프료 (neis.me)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Runtime dependencies

Existing upstream dependency versions are retained in `package-lock.json`. The packaged application includes `lunar-javascript` and its upstream license; Electron's runtime licenses remain alongside the executable.

## Notice keyword ranking references

The local notice parser independently implements keyword co-occurrence ranking using built-in JavaScript segmentation. Algorithm references: TextRank4ZH (MIT, https://github.com/letiantian/TextRank4ZH, commit 78c9b11657878a00ccb1555377ba8f7dfd5741d7). No source code or assets were copied and no runtime dependency was added. Comparison and provenance for TextRank4ZH, pke_zh and chrono are recorded in docs/notice-understanding-research.md.

## Bootstrap Icons

- Source: https://github.com/twbs/icons/tree/v1.10.5
- Version: v1.10.5; source SVGs: `icons/house.svg` and `icons/calendar-event.svg`.
- Reused: the original path data and 16 × 16 viewBox, rendered inline at 20 × 20 pixels with currentColor fill and no stroke. Accessible button labels added. No other assets or application code copied.
- WeekToDo is a visual reference only; its GPL application code is not included.
- License: https://github.com/twbs/icons/blob/v1.10.5/LICENSE (full text below).

The MIT License (MIT)

Copyright (c) 2019-2023 The Bootstrap Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## 中国未来年份与节假日数据（2026-10-22）

- 复用现有 6tail/lunar-javascript 1.7.7（MIT）作为算法回退；1901—2100年农历和节气优先采用下述香港天文台表。1901年最初19天的月份/闰月/农历年仍为推算。传统节日随所采用农历日期推导；闰月不重复传统节日。
- 新增数据读取来源：https://github.com/NateScarlet/holiday-cn 。本次核验提交 62a7973b914864416b5ecabdd2c300cd433af6b8（2026-10-11），2027.json 的 papers/days 均为空。运行时按 master 年度 JSON 读取后续公开更新；缓存保留 papers 来源，不执行仓库代码，不新增依赖。
- holiday-cn 数据与协议使用 MIT 许可；新增本地代码只适配其 JSON 格式，并校验年份、日期、重号、布尔类型、公告域名和大小。公告链接校验不等于核验正文；候选表还必须与本项目逐项核验的公告基线完全一致才可采用。目前只有2026年已核验，其他年份待核验。

Copyright (c) 2019 NateScarlet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## 香港天文台公历与农历对照表（2026-10-22 核验快照）

- 来源及资料权属：香港天文台、香港特别行政区政府。nelumi 非官方产品，未获政府或天文台背书。
- 年表入口：https://www.hko.gov.hk/tc/gts/time/conversion.htm 。使用1901—2100年纯文字表的日期事实，繁简转换并压缩为月首、农历日序和节气表；源文件网址、下载时间和SHA-256保存在项目 audit/calendar-2026-10-22/hko。
- 开放数据目录：https://data.gov.hk/tc-data/dataset/hk-hko-rss-gregorian-lunar-calendar-conversion-table 。开放数据条款：https://data.gov.hk/tc/terms-and-conditions 。资料及其知识产权原属政府及上述提供机构，以现状提供；本项目的MIT代码许可证不替代来源资料的条款。
- 天文台明确提示接近午夜的新月/节气可能产生一日差异。本软件保留提示及核验范围，不作绝对准确性担保。
- GitHub chinese-days、chinese-calendar 和 Apple Calendar 文档仅作更新/审核流程参考，未复制这些项目代码或资产。


## Local image OCR (2026-11-01)

- Tesseract.js 7.0.0: https://github.com/naptha/tesseract.js — Apache-2.0. Unmodified browser bundles; local worker/core/model paths.
- tesseract.js-core 7.0.0: https://github.com/naptha/tesseract.js-core — Apache-2.0. Embedded WASM bundles copied unchanged.
- chi_sim and eng models: https://github.com/naptha/tessdata — Apache-2.0 model data; obtained from @tesseract.js-data/chi_sim and eng 1.0.0, 4.0.0_best_int. Package metadata uses MIT; this does not replace the model license.
- Applicable license texts and upstream bundle notices are preserved under src/vendor/ocr/licenses and *.LICENSE.txt. manifest.json records file hashes and versions; package-lock.json records npm integrity.
- RapidAI/RapidOCR and hex3l/webocr were comparison/interaction references only; no code copied.
- New application adapter: in-memory image preparation, Chinese whitespace normalization, progress/cancel controls and existing notice parsing integration. No external OCR service or image persistence.
