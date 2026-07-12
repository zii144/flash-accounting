# App Store metadata — translation status

The store listing ships in all 16 languages the app supports. Every locale
below has **final native copy** (localized display name, subtitle, promo text,
description, keywords, and release notes). Edit the `.txt` files under
`fastlane/metadata/<locale>/`, or update the copy objects in
[`../scripts/gen-appstore-metadata.mjs`](../scripts/gen-appstore-metadata.mjs)
and regenerate with `--force`.

Keep within Apple's limits: name/subtitle ≤ 30, promotional text ≤ 170,
keywords ≤ 100, description ≤ 4000 characters.

| Locale  | Language              | Display name            | Status    |
| ------- | --------------------- | ----------------------- | --------- |
| en-US   | English               | Black White Accounting  | ✅ final  |
| zh-Hant | Traditional Chinese   | 黑白記帳                  | ✅ final  |
| ja      | Japanese              | 白黒家計簿                 | ✅ final  |
| ko      | Korean                | 흑백가계부                 | ✅ final  |
| es-ES   | Spanish               | Contabilidad B/N        | ✅ final  |
| fr-FR   | French                | Compta Noir & Blanc     | ✅ final  |
| de-DE   | German                | SchwarzWeiß Finanzen    | ✅ final  |
| it      | Italian               | Conti Bianco Nero       | ✅ final  |
| pt-BR   | Portuguese (Brazil)   | Conta Preto e Branco    | ✅ final  |
| ru      | Russian               | Чёрно-белый учёт        | ✅ final  |
| hi      | Hindi                 | ब्लैक व्हाइट हिसाब         | ✅ final  |
| id      | Indonesian            | Akuntansi Hitam Putih   | ✅ final  |
| vi      | Vietnamese            | Sổ Đen Trắng            | ✅ final  |
| th      | Thai                  | บัญชีขาวดำ               | ✅ final  |
| tr      | Turkish               | Siyah Beyaz Muhasebe    | ✅ final  |
| pl      | Polish                | Czarno-białe finanse    | ✅ final  |

Marketing spine and Traditional Chinese terminology come from
[`../docs/marketing/zh-tw-promotion.md`](../docs/marketing/zh-tw-promotion.md)
(無感漏財 / 幽靈消費 / 訂閱疲勞 …).
