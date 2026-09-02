# Spec: 評論產品（Comment）

Triage label: `ready-for-agent`

## Problem Statement

HK01 的文章頁需要一個評論系統，讓登入讀者圍繞文章討論。今天沒有這個產品：讀者無處寫評論、無法互相回應、無法對評論表達共鳴；同時，媒體場景下開放評論必然帶來違規內容與違規用戶，營運團隊需要工具去搜尋、審核、刪除與封鎖，而現有工具（或沒有工具）做不到，且操作員反映必須在桌面電腦才能操作，通勤時段無法處理時間敏感的待審評論。

## Solution

一個後端、以應用為隔離單位服務多個產品（一個產品一個應用，key resources 分開）：

- **應用層**：每個產品一個應用（application），擁有獨立的評論、emoji、靜音、檢舉、封鎖、敏感字、系統設定與審計紀錄；所有 API 必帶應用 key（ADR-0009）。評論 ID 生成時即全球唯一（ULID，經 API 暴露），前端以此單一 ID 構造評論的 canonical URL；應用 slug 是可選的 URL 可讀性前綴。用戶與操作員跨應用共用，但其在各應用內的狀態互相獨立。
- **前端（網頁／App）**：登入用戶可閱讀評論區（主評論＋分支兩層結構）、寫評論、按 emoji（笑／哭／加油）與一鍵三連、靜音其他用戶、檢舉單則評論（檢舉後該則對檢舉者永遠隱藏）。未登入完全看不到評論區。
- **控制台（響應式網頁）**：操作員經內部授權系統登入（單一權限），先選應用再操作，可搜尋該應用所有評論（關鍵字／時間／文章 key／狀態）、從用戶出發搜尋並查看評論數據、刪除評論、施加一般／完全封鎖、人審待審評論（批准／拒絕）、管理自訂敏感字、設定該應用的評論間隔與每日上限。待審審核以手機體驗為第一優先。
- **機審**：評論送出時經網易雲盾（Yidun）SaaS 判定，命中即進待審（先審後發，僅作者可見）。

## User Stories

### 應用層

0. As an operator, I want to create an application for each product (system generates the application key), so that each product's comments and settings are isolated.
0a. As an operator, I want to select an application in the console before operating, so that all search, moderation, blocking and settings act on that application only.
0b. As an operator, I want to see the list of applications, so that I can navigate between products.
0c. As an operator, I want to rename an application, so that the display name stays accurate as products evolve.
0d. As an operator, I want to disable an application, so that a deprecated product's comment section goes dark without deleting data.
0e. As an operator, I want to set a URL-friendly slug when creating an application (system-wide unique, immutable after creation), so that URLs can optionally carry a human-readable app identifier as a prefix.
0f. As a logged-in user, I want every comment to have a single globally unique ID (generated at creation, exposed via the API), so that the frontend can build each comment's canonical URL with zero composition logic and comments can be shared and indexed like articles.

### 前端：閱讀

1. As a logged-in user, I want to see the main comments of an article (most relevant first by default, infinite scroll), so that I can see the most engaging discussion.
1a. As a logged-in user, I want to switch the main comment list sorting between most relevant (highest 熱度), newest first, and oldest first, so that I can browse comments the way I prefer.
2. As a logged-in user, I want to see the reply count of each main comment's branch, so that I can decide whether to expand it.
3. As a logged-in user, I want to expand a branch and read its replies (oldest first, infinite scroll within the branch when long), so that I can follow the full conversation.
4. As a logged-in user, I want to see each commenter's nickname and avatar, so that I can identify who is speaking.
5. As a logged-in user, I want to see the total count of each emoji on a comment, so that I can gauge how much it resonates.
6. As a logged-in user, I want to see my own pending-review comments marked "審核中" (visible only to me), so that I know my comment was submitted and is awaiting review.
7. As a logged-in user, I want to see my own rejected comments marked "未通過審核", so that I know my comment did not pass review.
8. As a logged-in user, I want deleted main comments to appear as a "此評論已被 01 管理員刪除" placeholder (sub-comments preserved), so that the conversation still makes sense.
9. As a visitor, I cannot see the comment section at all when not logged in, so that every interaction has an accountable identity (product decision).
9a. As a logged-in user, I want to batch-fetch the top few comments, total comment count, and total emoji count for multiple articles in one request (capped at N articles x M comments each), so that the listing page can preview comment activity across articles without overloading the system.
9b. As a logged-in user, I want to see a hot-comment-list (articles ranked by 文章熱度), so that I can jump straight to the most active discussions without browsing each article.

### 前端：寫評論

10. As a logged-in user, I want to post a main comment (plain text, max 1000 chars, line breaks allowed), so that I can join the discussion.
11. As a logged-in user, I want to reply within a branch (no @-mention, no new level, chronological order), so that I can converse without deep nesting.
12. As a logged-in user, I want a clear error with remaining wait time when my comment interval has not elapsed, so that I know when I can post again.
13. As a logged-in user, I want a clear error with today's remaining quota when my daily limit is exhausted, so that I know I am out of quota.
14. As a logged-in user, I want my comment to enter pending review (visible only to me) when it hits a sensitive word, so that I know it needs human review.
15. As a blocked user, I want a clear "你的帳號已被限制寫評論" error when I try to comment, so that I know my account is restricted.
15a. As an auto-banned user, I want a clear error indicating I am temporarily restricted due to reports, so that I know why I cannot comment.
16. As a fully-blocked user, I cannot see the comment section at all, so that full block is total isolation (product decision).

### 前端：emoji 與三連

17. As a logged-in user, I want to react with an emoji (笑／哭／加油; one per emoji per comment per user), so that I can express how I feel.
18. As a logged-in user, I want to cancel my emoji by tapping again, so that I can change my mind.
19. As a logged-in user, I can react to my own comments, so that self-expression is unrestricted.
20. As a logged-in user, I want a one-tap triple reaction (all three emojis at once, once per comment), so that I can express strong resonance quickly.
21. As a logged-in user, I want the triple-reaction button greyed out after use, so that I know I have already used it on this comment.

### 前端：靜音

22. As a logged-in user, I want to mute another user (all their comments, past and future, hidden from me; reversible; the muted user never knows), so that I can filter out content I do not want to see.
23. As a logged-in user, I want to unmute a user, so that I can restore their comments.
23a. As a logged-in user, I want to report a comment (it becomes permanently hidden from me, and reporting a main comment also hides its replies from me; unlimited reports), so that I can hide a single comment I find problematic without muting the entire user.
23b. As an operator, I want to see report records (who was reported how many times, who reported them, which comment was reported), so that I can spot problematic users or content via crowd signals.
23c. As an operator, I want to see auto-ban status and reasons (which tier triggered, report count, cumulative offense count), so that I can review and manually unban if a false positive occurred.
23d. As an operator, I want to configure auto-ban tier thresholds (report count per tier) and durations, so that I can tune the system against spam patterns.

### 控制台：登入與權限

24. As an operator, I want to sign in to the console via the internal auth system, so that I can use all management features.
25. As an operator, I have every feature upon login (single permission), so that no permission management is needed.

### 控制台：搜尋

26. As an operator, I want to search all comments by keyword, so that I can find specific content.
27. As an operator, I want to search comments by time range, so that I can narrow down to an incident window.
28. As an operator, I want to search comments by article key, so that I can handle a specific article's comments.
29. As an operator, I want to filter comments by status (pending / published / deleted), so that I can process each status separately.
30. As an operator, I want to delete a comment directly from search results, so that I can act on violations quickly.
30a. As an operator, I want to bulk-delete all comments under a specific article key, so that I can quickly clean up a problematic article's comment section.
30b. As an operator, I want to bulk-delete all comments by a specific user, so that I can remove a spammer's entire footprint in one action.
31. As an operator, I want to search users (member ID primary, nickname secondary), so that I can manage from the user side.
32. As an operator, I want to see a user's comment stats (total, status breakdown, last-30-days daily volume, last comment time, account status), so that I can decide whether to block them.
32a. As an operator, I want to look up a specific main comment by its comment ID, so that I can directly locate and handle it (e.g. when receiving a report or customer complaint).

### 控制台：審核

33. As an operator, I want to see the pending-review queue and approve or reject each item, so that I can complete human review.
34. As an operator, I want to manage custom sensitive words (add / remove, synced to the content moderation service), so that I can supplement the machine-review vocabulary.
35. As an operator, I want to view the audit log (who deleted what, blocked whom, changed which words, and when), so that operations are traceable.

### 控制台：封鎖與系統管理

36. As an operator, I want to apply a normal block to a user (can view, cannot comment), so that I can restrict minor offenders.
37. As an operator, I want to apply a full block to a user (cannot view, cannot comment), so that I can isolate severe offenders.
38. As an operator, I want to manually unblock a user, so that I can correct mistakes.
39. As an operator, I want to set the comment interval for the selected application, so that I can control posting frequency.
40. As an operator, I want to set the daily comment limit for the selected application, so that I can control total volume.
40a. As an operator, I want to set the new-user cooldown period (how long after registration a user cannot comment), so that I can prevent spammers from creating accounts and immediately flooding the system.
41. As an operator, I want to see a user's block status (normal / normal-blocked / fully-blocked), so that I can keep track of account states.

### 控制台：行動場景

42. As an operator, I want to use the console in a mobile browser (responsive web, no app install), so that I can operate during commute when no desktop is available.
43. As an operator, I want to approve / reject pending comments with one thumb (review flow designed mobile-first), so that I can clear the queue anywhere, anytime.
44. As an operator, I want search, blocking and system settings to be usable on mobile (responsive, not mobile-optimized), so that I can handle urgent matters away from my desk.

## Implementation Decisions

- **應用層**：一個產品一個應用（application），key resources 按應用分開——評論（文章 key 只在應用內唯一）、emoji、靜音、檢舉、自動封禁（犯規累計按應用計）、封鎖、敏感字、系統設定（間隔／每日上限／新用戶冷卻期／自動封禁 tier）、審計紀錄；用戶與操作員跨應用共用，但各應用內狀態互相獨立；封鎖不跨應用（ADR-0009）。所有 API（前端＋控制台）必帶應用 key；控制台操作前先選應用；資料表加 application_id，unique constraint 改複合鍵；Redis 快取 key 與批次端點（N 篇 x M 則）以應用為範圍；雲盾設定按應用配置（整合細節待補，屆時更新 ADR-0001）。應用由控制台建立、系統產生應用 key；應用可改名、可停用（停用＝前端 API 一律 404／評論區熄滅，資料保留）；應用不可刪除。
- **識別字**：應用 key＝機器識別字（系統產生，API 呼叫必帶）；應用 slug＝公開識別字（操作員建立時設定，小寫英數字＋連字號、長度 3–32、全系統唯一、建立後不可改——URL 穩定性優先，要改的是顯示名稱），角色是可選的 URL 可讀性前綴、不參與唯一性。評論 ID＝生成時即全球唯一的 ULID（26 字元、Crockford base32、時間排序），經 API 暴露；前端以此單一 ID 構造每則評論的 canonical URL（文章已有自己的 canonical URL，評論也要有自己的），零組合 logic；URL 路徑結構由前端自定（想加應用 slug 前綴就加），評論系統不擁有 URL。評論表主鍵即評論 ID，其餘表複合鍵照舊；評論 ID 雖全球唯一，存取仍以應用 key 為範圍（用別的應用 key 查 → 404，隔離不變）。
- **結構**：兩層＋分支內扁平（無 @ 對象）；主評論支援三種排序（relevant 熱度降序 / newest 降序 / oldest 升序），預設 relevant；分支內最舊在前；cursor 分頁；無限捲動（主列表與分支內皆是）；分支預設收合、顯示子評論數。
- **熱度**：emoji 總數（笑＋哭＋加油）＋分支內子評論數；relevant 排序以此降序。
- **文章 key**：呼叫方提供的任意字串（建議 UUID），評論系統不管理文章本身。
- **emoji**：固定 3 個（笑／哭／加油）；每 emoji 每人每則一次、可取消；三連＝三個全給的快捷、每則一次；只顯示數字、不顯示誰按；可按自己的。
- **靜音**：用戶級、可解除、被靜音者零感知；顯示會員暱稱＋頭像（沿用會員系統資料）。
- **檢舉**：用戶對單則評論檢舉，檢舉後該則對檢舉者永遠隱藏、數量不限；控制台可見檢舉紀錄（被檢舉者、檢舉者、被檢舉評論）。
- **自動封禁**：用戶被檢舉達 tier 門檻即自動封禁，採累計犯規升級模型（第 1 次 tier 1 封 1 天、第 2 次 tier 2 封 1 週、第 3 次 tier 3 封 1 個月、第 4 次永久封禁）；tier 1-3 為一般封鎖，永久封禁為完全封鎖；門檻由控制台設定（預設 5/10/20，24 小時滾動窗口計算）；操作員可見狀態與原因、可手動解封；審計紀錄記「系統自動封禁」。
- **權限**：未登入完全不可見（ADR-0003）；用戶不可刪不可編自己的評論（ADR-0002）；檢舉見上方「檢舉」與「自動封禁」決策（ADR-0008）。
- **機審**：網易雲盾 SaaS 判定，命中即待審；先審後發；自訂詞同步到雲盾自訂詞庫（ADR-0001，整合細節待補）。
- **人審**：操作員批准／拒絕；被拒評論對作者顯示「未通過審核」；無超時自動批准／拒絕。
- **刪除**：僅操作員可刪；刪主評論留「此評論已被 01 管理員刪除」佔位、子評論保留；分支子評論被刪單則移除；無復原按鈕（審計留痕）。支援批次刪除：按文章 key（刪該文章所有評論）、按用戶（刪該用戶所有評論）。
- **封鎖**：無期限、可手動解封；一般／完全兩種模式都不隱藏既有評論（ADR-0004）；被拒時回明確訊息。
- **額度**：送出即計（待審、被拒都算）；間隔從上次送出起算；日界 UTC+8；按應用設定單一值。新用戶冷卻期：註冊後 N 時間內不能寫評論，N 按應用由控制台設定。
- **內容**：純文字、上限 1000 字、允許換行、URL 當普通文字。
- **控制台**：響應式網頁；操作前先選應用，所有操作以所選應用為範圍；審核以行動體驗為第一優先；搜尋結果可直接刪；用戶搜尋以會員 ID 為主、暱稱為輔（會員系統提供查詢介面）；審計紀錄記操作人＋時間、UI 只做列表。
- **整合**：前端會員系統與控制台內部授權是兩套獨立系統；操作員帳號沿用內部授權系統；前端 API 優先、不出 widget／SDK。
- **即時性**：自己的評論樂觀更新立即出現；他人的新評論需重新整理（v1 無推送）。
- **效能**：高流量媒體場景；Redis 快取熱門文章列表第一頁與 emoji 計數（TTL 30s，寫入失效，快取 key 以應用為範圍）；列表查詢走 PG 讀副本；批次取文章評論上限 N=20 篇 x M=3 則（ADR-0007）。
- **熱度榜 API**：跨文章的熱度排名，按文章熱度降序，快取在 Redis；批次取文章評論 API 同時回傳評論數與 emoji 總數（分開提供，前端可同時顯示）。
- **靜音資料形態**：評論系統自己的表（user_id → muted_user_id），不外溢到會員系統。
- **排序 tiebreaker**：created_at 存到毫秒（TIMESTAMPTZ），不另加 sequence 欄位。
- **emoji 取消**：toggle 語義（按→+1、再按→歸零、再按→+1），最終態只看當前是否 active。
- **控制台搜尋分頁**：傳統分頁（頁碼），非無限捲動；操作員需跳頁與看總數。
- **審計紀錄保留**：永久保留（合規需求，儲存成本低）。
- **技術棧**：後端 NestJS + TypeScript；資料庫 PostgreSQL（ADR-0005）；前端框架待定（網頁＋App）。
- **機審整合模式**：同步。評論送出時 call 雲盾 API，等回應（幾百 ms），命中即待審、不命中即發佈。
- **控制台授權**：Logto（OIDC SaaS），NestJS 驗證 Logto 簽發的 JWT；不自建登入頁（ADR-0006）。前端會員系統整合介面待定。

## Testing Decisions

- **單一測試 seam：HTTP API 層**（前端 API＋控制台 API）。所有行為從 API 的輸入／輸出觀察；雲盾以合約測試樁代替，不依賴真實服務；UI（網頁／App／控制台）薄，不另建測試 seam。
- **好的測試只測外部行為**：透過公開介面（前端 API、控制台 API）驅動，不斷言內部結構。狀態機（評論的 pending → published / rejected、用戶的 normal → normal-blocked / fully-blocked）以輸入與可觀察輸出驗證。
- **測試模組**：應用隔離（兩應用同文章 key 互不干擾、封鎖／設定／敏感字按應用獨立、slug 全系統唯一且建立後不可改、評論 ID 跨應用全球唯一）、評論生命週期（送出→機審→人審→顯示）、額度與間隔、emoji／三連計數、靜音過濾、封鎖模式、控制台搜尋與審計。
- **Prior art**：repo 目前是純文件（無程式碼），測試從零開始；機審邊界（雲盾回應）以合約測試樁代替，不依賴真實服務。

## Out of Scope

- 置頂評論、官方／認證標籤、單篇文章關閉評論
- 通知（子評論通知、審核結果通知）
- 用戶自刪／自編輯評論
- 熱門排序
- 嵌入式 widget／SDK
- 操作員帳號管理（沿用內部授權系統）
- 誤刪復原
- 即時推送
- 針對個別用戶覆寫間隔／額度
- 待審超時自動批准／拒絕
- 控制台原生 App／PWA
- 跨應用聯合封鎖（一次封全部應用）
- 應用刪除（資料永久保留，只可停用）
- 應用 slug 修改（建立後不可改，URL 穩定性優先）
- 應用層級的操作員權限差異（單一權限，所有操作員可管理所有應用）

## Further Notes

- **Issue tracker**：spec 待發佈到 Jira（GitHub 在後）。發佈時套用 `ready-for-agent` label。
- 詞彙表見 `CONTEXT.md`；ADR 見 `docs/adr/`（0001 雲盾機審、0002 不可自刪自編、0003 登入牆、0004 封鎖不隱藏既有評論、0005 PostgreSQL、0006 Logto 控制台授權、0007 高流量效能策略、0008 檢舉驅動自動封禁、0009 應用層隔離）。
- 雲盾整合細節（同步／非同步判定、自訂詞同步方式、API 形態）待補，屆時更新 ADR-0001。
- 詳細 user story 清單（中文版）見 `docs/user-stories.md`。
