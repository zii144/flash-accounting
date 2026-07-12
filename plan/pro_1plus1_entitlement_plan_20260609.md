# 黑白記帳｜Pro 1＋1 權限共享方案實作計畫

## 文件目的

此文件定義黑白記帳 `Pro 1＋1` 促銷方案的產品規則、系統設計、開發分期、風險與驗收標準。

目標不是只描述「可以分享給另一人」這句話，而是把整個方案落成為可實作、可測試、可營運的規格。

---

## 一句話結論

建議把 `1＋1 Pro` 設計為：

> **一位付費訂閱擁有者（owner）＋一個可指派的共享席位（guest seat）**

並由後端管理共享資格，而不是直接依賴 RevenueCat 將一筆訂閱視為兩個獨立使用者的原生 entitlement。

原因很簡單：

- 目前 App 內的 Pro 判斷只知道「這個登入者自己有沒有 RevenueCat Pro」。
- 但 `1＋1` 真正需要判斷的是「這個登入者是否被另一位 Pro 使用者授權共用」。
- 這類共享關係不是 App Store / Play Store / RevenueCat 原生 entitlement 模型的強項，因此必須增加 App 自己的授權層。

---

## 現況摘要

依目前程式架構，幾個關鍵事實如下：

- `RevenueCat` 目前是購買與 entitlement 狀態的來源。
- `Pro` 主要代表雲端同步資格。
- App 目前的雲端資料仍是以個人 `uid` 為單位儲存在 Firestore。
- 雲端同步啟用條件目前是 `signed in + isPro`。
- App 目前尚未實作真正的「雙人共用帳本」資料模型。

這代表：

- 若現在直接做 `1＋1`，最穩定的第一階段做法是「共享 Pro 使用資格」。
- 不建議在同一階段同時完成「共享 Pro」與「共享帳本」。
- `共享訂閱` 與 `共享資料模型` 必須拆成兩條工作線。

---

## 核心決策

## 決策 1：Phase 1 只共享 Pro 資格，不共享帳本資料

Phase 1 建議只解決：

- 第二位使用者可取得 `Pro` 功能權限
- 第二位使用者可使用自己的雲端同步
- 第二位使用者可跨裝置還原自己的資料

Phase 1 不處理：

- 雙方共用同一份消費記錄
- 雙人共同帳本
- 代墊、拆帳、共同結算

這樣的好處：

- 可以沿用目前 `users/{uid}/consumptions` 的資料結構
- 不需要立刻重做同步模型
- 不需要立刻大改 Firestore 規則
- 可以先把促銷方案上線，降低整體風險

## 決策 2：共享資格由後端授權，不由前端推導

前端只能顯示與查詢共享狀態，不能成為共享資格的唯一判定者。

後端必須負責：

- 驗證 owner 是否真的有有效 Pro
- 建立或撤銷 guest 的共享資格
- 在訂閱失效時自動收回 guest 權限
- 防止濫用與重複指派

## 決策 3：共享席位固定只有 1 個

此促銷方案的系統規則應非常明確：

- 一位 owner 只能同時綁定一位 guest
- 一位 guest 同時只能占用一個 owner 的席位
- guest 不能再向外分享

這樣能讓 UI、客服、計費、風控都簡單很多。

---

## 產品規則

## 使用者角色

定義三種與 Pro 相關的使用者身分：

1. `owned_pro`
   代表使用者本人有有效的 RevenueCat Pro 訂閱。
2. `shared_pro`
   代表使用者本人沒有自己付費，但被某位 owner 共享了一個有效席位。
3. `no_pro`
   代表沒有 Pro 權限。

## 資格規則

- owner 必須登入帳號才可分享。
- guest 必須登入帳號才可接受分享。
- owner 必須有有效 Pro 才能建立或保留共享席位。
- guest 若已有自己的 Pro，預設不占用共享席位。
- guest 若失去共享資格，立即降為 `no_pro`，除非他自己本來就有 `owned_pro`。

## 席位規則

- 一個 owner 同時只能有一個 active guest。
- owner 可主動撤銷 guest。
- owner 可重新指派給其他人，但建議加入冷卻時間，例如 `24 小時`。
- guest 離開共享後，不可保證立即能重新加入其他 owner，是否加冷卻可視營運策略決定。

## 訂閱生命週期規則

- owner 新購或恢復 Pro 時，可建立共享席位。
- owner 取消訂閱但仍在有效期內，共享仍保留至到期。
- owner 進入 billing issue / grace period，共享是否保留需明確定義。
- 建議：grace period 內保留共享，真正失效後再撤銷。
- owner 過期、退款、撤銷、產品撤回後，共享席位自動失效。

## 風控規則

- 共享邀請只能由後端簽發。
- 共享接受時需再次驗證 owner 狀態。
- 每次 seat 轉移需記錄 audit log。
- 建議限制頻繁換人，例如 30 天內最多 2 次 seat reassignment。

---

## 非目標

以下內容不應混入 Phase 1：

- 家庭方案多人席位
- 雙人共用同一本帳
- 共同分類、共同預算
- 分帳、代墊、結算
- 即時協作同步
- 多人聊天室或邀請通知中心

這些都屬於後續共享帳本產品線，而不是 `1＋1 entitlement sharing` 的必要條件。

---

## 建議系統架構

## 架構原則

整體權限來源拆成兩層：

1. `Store / RevenueCat 層`
   負責回答「誰付了錢」。
2. `App 授權層`
   負責回答「誰因此可以用 Pro」。

最終 App 真正要使用的是：

> **effective Pro access**

也就是綜合以下兩者後的結果：

- 使用者本人是否擁有有效 Pro
- 使用者是否被某位有效 Pro owner 授權共享

## 權限判定公式

建議統一成以下概念：

```text
effectiveProAccess =
  hasOwnedRevenueCatPro
  OR
  hasActiveSharedSeat
```

前端不要再只依賴 `isPro`。

前端應改為依賴：

- `proAccessSource`
- `hasEffectivePro`
- `ownedPlanStatus`
- `sharedSeatStatus`

---

## 後端資料模型建議

建議新增一個 App 自己管理的訂閱授權模型。

## 方案 A：以 owner 為中心的結構

```text
subscription_accounts/{ownerUid}
subscription_accounts/{ownerUid}/members/{memberUid}
subscription_accounts/{ownerUid}/invites/{inviteId}
user_access/{uid}
entitlement_audit_logs/{logId}
```

## `subscription_accounts/{ownerUid}`

建議欄位：

```ts
{
  ownerUid: string;
  ownerEmail: string | null;
  revenueCatAppUserId: string | null;
  revenueCatCustomerId: string | null;
  productTier: "pro";
  subscriptionStatus: "active" | "grace_period" | "expired" | "refunded" | "revoked";
  seatLimit: 1;
  activeSeatCount: number;
  activeGuestUid: string | null;
  activeGuestEmail: string | null;
  shareState: "empty" | "invited" | "occupied";
  currentPeriodEndsAt: string | null;
  lastRevenueCatEventAt: string | null;
  lastSeatChangedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

## `subscription_accounts/{ownerUid}/members/{memberUid}`

建議欄位：

```ts
{
  ownerUid: string;
  memberUid: string;
  role: "guest";
  accessState: "active" | "revoked" | "expired";
  invitedByUid: string;
  invitedAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokeReason: string | null;
  source: "promo_1plus1";
}
```

## `subscription_accounts/{ownerUid}/invites/{inviteId}`

建議欄位：

```ts
{
  inviteId: string;
  ownerUid: string;
  inviteeEmail: string | null;
  inviteCode: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expiresAt: string;
  createdAt: string;
  acceptedByUid: string | null;
  acceptedAt: string | null;
}
```

## `user_access/{uid}`

這是一份給前端快速讀取的權限快照，可由後端同步維護。

建議欄位：

```ts
{
  uid: string;
  hasEffectivePro: boolean;
  accessSource: "owned" | "shared" | "none";
  ownerUid: string | null;
  ownerDisplayName: string | null;
  ownerEmailMasked: string | null;
  sharedSeatState: "none" | "active" | "revoked" | "expired";
  updatedAt: string;
}
```

---

## RevenueCat 與後端責任分工

## RevenueCat 負責

- 購買成功
- 續訂成功
- 取消自動續訂但仍在有效期內
- 到期
- billing issue
- refund
- restore purchase

## 後端負責

- 接收 RevenueCat webhook
- 更新 owner 訂閱狀態
- 決定 shared seat 是否仍然有效
- 更新 `user_access`
- 若 owner 失效則撤銷 guest 存取
- 寫入 audit log

## 不建議的做法

不建議讓 App 前端每次自行：

- 查 RevenueCat entitlement
- 再自己猜測是否應該共享
- 再直接寫 Firestore 指派 guest

原因：

- 易被繞過
- 容易產生競態條件
- 訂閱失效時難以同步收權

---

## 後端 API / Cloud Functions 建議

建議用 Firebase Cloud Functions 或其他輕量後端提供以下能力。

## 1. `createShareInvite`

用途：

- owner 建立分享邀請

輸入：

```ts
{
  inviteeEmail?: string;
}
```

輸出：

```ts
{
  inviteId: string;
  inviteCode: string;
  expiresAt: string;
}
```

驗證條件：

- 呼叫者必須是 owner 本人
- owner 必須有有效 Pro
- owner 目前沒有 active guest 或符合可替換規則

## 2. `acceptShareInvite`

用途：

- guest 接受分享

輸入：

```ts
{
  inviteCode: string;
}
```

驗證條件：

- guest 必須登入
- invite 必須有效
- owner 當下仍然有有效 Pro
- guest 目前不得同時占用其他 owner 的 seat

效果：

- 建立 member 關係
- 更新 `subscription_accounts`
- 更新 `user_access`
- 將 invite 標記為 accepted

## 3. `revokeSharedSeat`

用途：

- owner 主動收回 shared seat

驗證條件：

- 只能由 owner 呼叫

效果：

- member 狀態改為 revoked
- guest 的 `user_access` 改為 `none` 或回退到 `owned`
- 寫入 audit log

## 4. `getMyEffectiveAccess`

用途：

- 前端取得自己最終權限快照

輸出：

```ts
{
  hasEffectivePro: boolean;
  accessSource: "owned" | "shared" | "none";
  ownerUid: string | null;
  ownerDisplayName: string | null;
  seatState: "none" | "active" | "revoked" | "expired";
}
```

## 5. `syncRevenueCatWebhook`

用途：

- 處理 RevenueCat webhook 事件並同步 owner 狀態

事件範例：

- initial_purchase
- renewal
- expiration
- uncancellation
- billing_issue
- cancellation
- refund
- transfer

---

## Firestore Security Rules 建議方向

Phase 1 不建議讓 client 直接寫共享資格文件。

建議規則：

- `subscription_accounts` 僅允許相關使用者讀取有限欄位
- `members` 僅允許 owner 與 guest 讀取
- `invites` 原則上只允許 owner 讀取
- `user_access/{uid}` 只允許 `request.auth.uid == uid` 讀取
- 所有共享授權相關寫入，都只允許後端 Admin SDK 執行

這樣可以最大化避免：

- 自己把自己升級成 shared pro
- 竄改 seat 狀態
- 假造 owner / guest 關係

---

## 前端改動計畫

## 1. `ProContext` 擴充

目前 `ProContext` 主要只提供：

- `storagePlanId`
- `isPro`
- `isPlus`
- `hasUnlimitedLocal`

建議擴充為：

```ts
type ProAccessSource = "owned" | "shared" | "none";

type SharedSeatInfo = {
  ownerUid: string | null;
  ownerDisplayName: string | null;
  ownerEmailMasked: string | null;
  seatState: "none" | "active" | "revoked" | "expired";
};
```

新增狀態：

- `hasEffectivePro`
- `proAccessSource`
- `sharedSeatInfo`
- `ownedRevenueCatPlan`
- `refreshEffectiveAccess`

## 2. 雲端同步 gate 改寫

目前雲端同步條件接近：

```text
signed in + isPro
```

建議改為：

```text
signed in + hasEffectivePro
```

這是 `1＋1` 是否能真正生效的核心。

## 3. 設定頁 UI

owner 視角應新增：

- 目前 Pro 狀態
- 共享席位狀態
- 邀請 guest
- 取消邀請
- 撤銷 guest
- 重新指派說明

guest 視角應新增：

- 你目前由誰分享 Pro
- 共享資格是否有效
- 若失效，提示升級或等待 owner 恢復

## 4. Paywall 文案調整

文案必須明確，不要讓使用者誤解成 Apple Family Sharing。

建議文案方向：

- `一個 Pro 訂閱，可分享給 1 位夥伴`
- `雙方都需要登入帳號`
- `共享的是 Pro 權限，不一定代表共用同一份帳本`

若 Phase 1 尚未做共享帳本，這一句尤其要講清楚。

---

## Phase 1 與 Phase 2 分期

## Phase 1：共享 Pro 權限

### 功能範圍

- owner 可邀請 1 位 guest
- guest 可獲得 Pro 權限
- guest 可使用自己的雲端同步
- owner 可撤銷
- owner 失效時 guest 自動失效

### 不包含

- 共用帳本
- 雙方看同一份記錄
- 拆帳功能

### 優點

- 風險小
- 改動範圍清楚
- 可快速驗證市場是否買單 `1＋1` 方案

## Phase 2：共享帳本 / Household 模型

當產品要真正支援情侶、夫妻、家庭共同記帳時，再新增：

```text
households/{householdId}
households/{householdId}/members/{uid}
households/{householdId}/books/{bookId}
households/{householdId}/records/{recordId}
```

到這一階段才需要重新設計：

- 個人帳本與共享帳本切換
- 共用資料同步策略
- 資料權限與可見性
- 代墊、拆帳、結算

---

## 建議開發順序

## Milestone 1：權限基礎建設

目標：

- 讓 App 能辨識 `owned / shared / none`

工作項目：

- 建立 Firestore 資料結構
- 建立 Cloud Functions
- 建立 RevenueCat webhook 同步流程
- 建立 `user_access` 快照
- 擴充 `ProContext`

## Milestone 2：owner / guest 流程

目標：

- 完成邀請、接受、撤銷

工作項目：

- owner 建立邀請
- guest 接受邀請
- seat 狀態同步 UI
- 冷卻與重複綁定限制

## Milestone 3：同步與權限整合

目標：

- shared guest 可真正啟用雲端同步

工作項目：

- 將雲端同步 gate 改為 `hasEffectivePro`
- 驗證 guest 的同步流程
- 驗證 owner 失效後 guest 是否被正確降權

## Milestone 4：營運與風控

目標：

- 確保可客服、可追查、可恢復

工作項目：

- audit log
- 管理後台或最小 admin script
- support troubleshooting 文件
- FAQ / paywall 說明

---

## 驗收標準

## 產品驗收

- owner 購買 Pro 後可看到共享席位入口
- owner 可成功邀請一位 guest
- guest 接受後可取得 Pro 能力
- owner 可撤銷 guest
- owner 失效後 guest 權限自動消失
- guest 介面能清楚知道自己是共享資格

## 技術驗收

- 前端不再只用 RevenueCat 判定最終 Pro 權限
- 後端 webhook 能正確處理訂閱狀態改變
- `user_access` 能在合理時間內反映權限結果
- Firestore 規則可阻止 client 直接竄改 seat
- shared guest 雲端同步流程可正常運作

## 測試案例

- owner 新購 Pro
- owner restore purchase
- owner cancellation but still active
- owner expiration
- owner refund
- owner 邀請 guest
- guest 接受邀請
- guest 已有自己 Pro
- owner 撤銷 guest
- owner 改邀請其他人
- guest 登出再登入
- 網路異常時 invite / accept 重試

---

## 主要風險

## 風險 1：共享權限與共享帳本概念混淆

若文案沒有講清楚，使用者可能以為：

- 分享 Pro = 自動共用同一份帳本

但 Phase 1 若沒有做 household/shared book，這會造成大量誤解。

對策：

- Paywall、FAQ、設定頁都要清楚說明

## 風險 2：owner 失效後 guest 權限回收不即時

若 webhook 延遲或失敗，guest 可能短時間仍保有 Pro。

對策：

- 前端在關鍵路徑支援主動 refresh access
- 後端排程定期校正權限

## 風險 3：seat 被濫用反覆換人

對策：

- seat cooldown
- audit log
- 每月最大重綁次數限制

## 風險 4：guest 失效時雲端資料怎麼辦

如果 guest 在 shared pro 期間用了自己的雲端同步，失效後要定義行為。

建議：

- 停止新的雲端同步能力
- 保留既有雲端資料一段 grace window 或維持只讀策略
- 若要簡化第一版，也可直接停止同步但不自動刪資料

這一點要在產品政策中明確定義。

---

## 營運與客服政策建議

- FAQ 說明 `1＋1` 是一位 owner 加一位 guest
- 說明雙方都需登入
- 說明 owner 到期會影響 guest
- 說明 guest 不可再轉分享
- 說明共享權限與共享帳本是不同概念
- 建立客服處理情境：
  - owner 說自己有訂閱但 guest 沒拿到權限
  - guest 說權限突然消失
  - 使用者誤接受錯誤邀請
  - owner 想更換分享對象

---

## 建議時程

若以 Phase 1 為目標，建議拆成約 2 週到 3 週：

### 第 1 週

- 定稿產品規則
- 設計 Firestore schema
- 建立 Cloud Functions
- 接 RevenueCat webhook

### 第 2 週

- 前端 `ProContext` 改寫
- 設定頁邀請 / 接受 / 撤銷流程
- 權限與同步整合測試

### 第 3 週

- 補測試
- 補文件
- Paywall 與 FAQ 文案
- sandbox / staging 驗證

---

## 最後建議

最推薦的路徑是：

1. 先做 `Phase 1：共享 Pro 權限`
2. 確認市場對 `1＋1` 促銷有反應
3. 再做 `Phase 2：共享帳本 / 情侶家庭協作`

這樣可以避免把「促銷方案」與「多人資料模型重構」綁死在同一個 release。

對目前黑白記帳的程式架構來說，這是風險最低、落地最快、也最符合未來演進方向的做法。
