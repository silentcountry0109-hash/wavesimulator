# Claude Code 工作指引 — wavesimulator

> 這份文件由 Claude Code 在每個 session 啟動時自動讀取。修改後請隨變更一起 commit。

## 專案概述

物理教學用的**波動傳播模擬器**(橫波 + 縱波),React + Canvas 互動網頁。學生拖曳波源觀察波的傳播、介質質點運動、縱波疏密變化。功能說明見 [replit.md](./replit.md)。

## ⚠️ 部署工作流(所有修改都要考慮這件事)

```
本機(macOS)修改 → git push → Replit 端 git pull → Replit 部署(Linux)
```

- **本機是唯一的編輯端**。不要在 Replit 上直接改 code、不要用 Replit Agent 改,否則兩邊分岔必衝突。Replit 端只做乾淨的 `git pull`。
- 部署設定在 [.replit](./.replit):`npm run build` 打包 → `node ./dist/index.cjs` 啟動,deployment target 是 **autoscale**,PORT=5000 對外映射 80。

## 技術棧

- **前端**:React 18 + Vite + Tailwind CSS,HTML5 Canvas(rAF 動畫迴圈)
- **後端**:Express(只負責送靜態檔,無資料庫)
- **核心邏輯**:幾乎都在 `client/src/pages/wave-simulator.tsx`
- **Node 版本**:Replit 是 **nodejs-20**;本機是 v26 → 見下方規範第 1 條

## 本地開發指令(macOS)

```bash
cd ~/Documents/wavesimulator
PORT=3000 npm run dev        # 開發伺服器 → http://localhost:3000
                             # 必須指定 PORT=3000:macOS 的 AirPlay 占用了預設的 5000
npm run check                # TypeScript 型別檢查
npm run build                # production 打包(Vite + esbuild → dist/)
PORT=3000 npm start          # 用 production 模式跑(部署前驗證用)
```

## 開發規範(違反任何一條都可能「本機正常、部署炸掉」)

### 1. 平台差異:macOS(本機)≠ Linux(Replit)

- **後端程式碼只能用 Node 20 支援的 API**。本機 Node 26 跑得動不代表 Replit 的 Node 20 跑得動。不確定時查 API 的 "Added in" 版本。前端不受限(跑在瀏覽器)。
- **import 路徑大小寫必須與檔名完全一致**。macOS 不分大小寫、Linux 分,`import "./Foo"` 對應 `foo.tsx` 在本機能跑、Replit 直接炸。
- **平台專屬行為用條件式處理,不可直接刪除 Linux 行為**。範本:`server/index.ts` 的 `reusePort` 只在 `process.platform === "linux"` 時啟用(macOS 不支援會 ENOTSUP,但 Replit 需要它)。

### 2. Replit 部署依賴的約定,不能動

- `server/index.ts` 的 `process.env.PORT || "5000"` 與 `host: "0.0.0.0"` **保持原樣**。`.replit` 把 5000 映射到對外 80。本機嫌 5000 被占就用 `PORT=3000` 環境變數,不要改 code。
- `package.json` 的 **`build` 和 `start` 兩個 script 不能壞**,部署全靠它們。
- `vite.config.ts` 裡的 `@replit/*` plugins **留著**(只在 dev 生效,不影響打包)。
- dev 模式走 Vite middleware、production 走 `dist/public` 靜態檔,是兩條不同路徑。**改了 server 端或 build 相關設定後,push 前必跑一次** `npm run build && PORT=3000 npm start` 驗證 production 模式。

### 3. 套件管理

- 新增套件後 **`package-lock.json` 必須一起 commit**。
- **後端用的套件必須放 `dependencies`**(不能放 devDependencies)。`script/build.ts` 的 allowlist 之外的後端套件不會被 bundle 進 `dist/index.cjs`,部署時靠 `node_modules` 載入,只有 dependencies 會被安裝。
- 新增的後端套件若想加快冷啟動,可加進 `script/build.ts` 的 allowlist(非必要)。

### 4. Git 紀律

- **絕不 commit**:`dist/`、`node_modules/`、`.env`、任何金鑰(.gitignore 已處理前兩項)。
- 若未來需要秘密金鑰:本機放 `.env`(並加進 .gitignore),Replit 端用 **Replit Secrets**,兩邊不經過 git。
- Commit 訊息寫人話,中英文皆可。完成一個獨立功能就 commit + push,別累積。

### 5. Autoscale 架構限制(未來加功能時才會遇到)

Replit autoscale 是**無狀態、閒置會縮到零**的部署:

- 不可依賴記憶體狀態(in-memory session、全域變數快取)— 實例隨時消失。
- 不可寫本地檔案存資料。
- 要加資料庫 → 用 Replit 內建 PostgreSQL(`postgresql-16` module 已掛載、drizzle 設定已就緒)+ `DATABASE_URL` 環境變數。
- 要加 WebSocket 等長連線功能 → autoscale 不可靠,需改 Reserved VM,先評估再動工。

目前是純前端模擬器,第 5 條暫時碰不到;日常開發主要注意 1–4。

## 已知事項 / 修改紀錄

- **2026-06-12**:`server/index.ts` 的 `reusePort: true` 改為 Linux-only(macOS 會 ENOTSUP 啟動失敗)。
- 測試環境提醒:用自動化瀏覽器(headless / 隱藏分頁)驗證時,Chrome 會暫停 `requestAnimationFrame`,模擬器會看起來「完全不動」——這不是 bug,開可見分頁就正常。
- `package.json` 殘留大量 Replit 模板用不到的套件(passport、pg、drizzle、express-session 等),純前端 app 實際不需要;未清理,清理時注意 `script/build.ts` 的 allowlist 同步。
- `client/index.html` 的 `<title>` 仍是「橫波傳播模擬器」,與現有功能(橫波+縱波)不符,待改。

## 給 Claude 的工作守則

1. 每次 session 開始:讀完這份文件,特別是部署工作流與開發規範。
2. 任何修改前先想:「這在 Replit 的 Linux + Node 20 上跑得動嗎?」
3. 改了 server 端或 build 設定 → push 前必驗 production 模式。
4. 完成功能或修正後:更新本文件的「已知事項 / 修改紀錄」,連同程式碼一起 commit。
