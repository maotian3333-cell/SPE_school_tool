# 課表對照助手

教師課表／班級課表對照、家長會議日期調查單、學生資源班課表 PDF 批次產生。
所有資料只在瀏覽器內處理，不會上傳到任何伺服器。

## 檔案
- `index.html`　網頁本體
- `css/style.css`　版面與列印課表樣式
- `js/app.js`　所有功能

## 上傳到 GitHub 並開啟網頁（GitHub Pages）
1. 建立新的 repository（例如 `schedule-helper`），設為 Public。
2. 把本資料夾的檔案依相同路徑放進去：`index.html`、`css/style.css`、`js/app.js`、`README.md`。
   （網頁上可用 Add file → Create new file，檔名欄輸入 `css/style.css` 會自動建立資料夾。）
3. Settings → Pages → Source 選 `Deploy from a branch`，Branch 選 `main`、資料夾 `/ (root)`，按 Save。
4. 約一分鐘後，用 `https://你的帳號.github.io/schedule-helper/` 開啟。

## 常用修改位置（js/app.js）
- `EXTRA_STUDENTS`：由程式碼填入學生（班級、座號、姓名），格式見檔案開頭註解。
- `SUBJECT_SHORT`：課表上課名的縮短對照，例如 `'公民與社會':'公民'`。課名後的「（兼）」會自動去除。
- `TIMES`：預設節次時間（課表本身有時間時以課表為準）。
- 課表字體大小：`css/style.css` 中 `.c-res b`（資源班課名）、`.c-orig b`（原班課名）、`.c-orig span`（教師）。

## 注意
- 需要連網載入 Google 字型與 html2canvas、jsPDF、JSZip、SheetJS（cdnjs）。
- 下載 PDF 時，一次勾選很多學生會花些時間，請等待進度文字完成。
