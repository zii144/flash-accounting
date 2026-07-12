#!/usr/bin/env node
// Bootstrap the fastlane deliver metadata tree for App Store Connect.
//
// Writes fastlane/metadata/<locale>/*.txt for every language the app ships.
// Every locale carries final, native marketing copy (localized display names).
// See fastlane/TRANSLATION_STATUS.md.

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const METADATA_DIR = join(ROOT, "fastlane", "metadata");
const FORCE = process.argv.includes("--force");

// A support URL is required by Apple. Keep this a real HTTPS URL — the
// release script refuses to push while REPLACE_ME remains anywhere in metadata.
const SUPPORT_URL = "https://github.com/zii144/flash-accounting/issues";

const LANG_LIST =
  "English, 繁體中文, 日本語, 한국어, Español, Français, Deutsch, Italiano, Português, Русский, हिन्दी, Bahasa Indonesia, Tiếng Việt, ไทย, Türkçe, Polski";

// ---------------------------------------------------------------------------
// Canonical copy — one object per App Store Connect locale
// ---------------------------------------------------------------------------

const EN = {
  name: "Black White Accounting",
  subtitle: "Frictionless expense tracker",
  promotional_text:
    "No big buys this month — so why is your balance down? Log any expense in three seconds. Minimal, private, never nagging.",
  keywords:
    "expense,budget,money,finance,spending,tracker,ledger,accounting,saving,subscription,bookkeeping",
  release_notes:
    "Thanks for using Black White Accounting! This update brings performance improvements, bug fixes, and expanded language support.",
  description: `Where did the money go?

No big purchases this month, yet your balance still shrank. Coffees, deliveries, and auto-renewing subscriptions — these small, forgettable charges add up to far more than you think.

Black White Accounting is built for people who hate traditional expense apps.

Why Black White Accounting?

Frictionless logging
Amount, description, done — in about three seconds. No complicated categories, no nagging reminders, no cluttered screen you want to close the moment it opens.

Catch the spending you never notice
Small purchases are the easiest to overlook. Log them and see exactly how much quietly leaked out this month.

See the subscription trap
Record recurring charges as expenses and let the monthly summary surface the subscriptions you forgot you were paying for.

Private by default
Works offline. Your data is stored on your device.

Simple statistics
By day, month, week, or year — your spending patterns at a glance.

Dark mode
Follows your system appearance, easy on the eyes at night.

Optional Pro
Unlock cloud sync to back up your ledger and keep it when you switch phones.

16 languages
${LANG_LIST}

Take back control of your money — starting with seeing every expense you'd normally miss.

Download Black White Accounting and start noticing where your money really goes.`,
};

const ZH = {
  name: "黑白記帳",
  subtitle: "零摩擦記帳，追蹤無感消費",
  promotional_text:
    "這個月沒大買，戶頭怎麼變少？小額支出、訂閱扣款——無感漏財才是元兇。三秒記一筆，極簡不煩你。Pro 雲端同步，換機不丟帳。",
  keywords:
    "記帳,記帳App,支出,消費,訂閱,理財,存錢,預算,簡單記帳,極簡記帳,無感消費,訂閱管理,個人財務",
  release_notes:
    "感謝使用黑白記帳！本次更新帶來效能優化、問題修正，以及更多語言支援。",
  description: `錢去哪了？

這個月沒有大手筆，戶頭卻還是變少。手搖、外送、訂閱自動扣款——這些幽靈消費加起來，比你想像的多很多。

黑白記帳，專為討厭傳統記帳 App 的人設計。

為什麼選黑白記帳？

零摩擦記帳
金額、描述，三秒完成。沒有複雜分類、沒有惱人提醒、沒有打開就想關的介面。

追蹤無感消費
小額支出最容易被忽略。記下來，統計頁一眼看清本月無感漏財總額。

訂閱陷阱，看得見
把固定訂閱記成支出，每月統計幫你揪出訂閱疲勞的寄生蟲。

隱私優先，資料永遠在你手上
離線可用，只於本機儲存。

極簡統計
按日、按月、本週、本年——支出模式一目了然。

深色模式
跟著系統切換，夜間記帳也舒服。

Pro 進階
解鎖雲端同步，備份帳本，換手機也不丟資料。

多語言支援（16 種語言）
繁體中文、English、日本語、한국어、Español、Français、Deutsch、Italiano、Português、Русский、हिन्दी、Bahasa Indonesia、Tiếng Việt、ไทย、Türkçe、Polski

重掌財務主導權，從看清每一筆無感消費開始。

下載黑白記帳，開始重新意識新時代的理財觀念。`,
};

const JA = {
  name: "白黒家計簿",
  subtitle: "ストレスフリー家計管理",
  promotional_text:
    "大きな買い物はないのに、残高が減る？小さな支出とサブスクを3秒で記録。シンプル・端末内保存・催促なし。",
  keywords:
    "家計簿,支出,節約,予算,サブスク,お金,会計,家計管理,シンプル,プライベート,記帳",
  release_notes:
    "白黒家計簿をご利用ありがとうございます。パフォーマンス改善、不具合修正、言語対応の拡充を行いました。",
  description: `お金はどこへ消えた？

大きな買い物はないのに、残高は減っていく。カフェ、デリバリー、自動更新のサブスク——忘れがちな小さな支払いが、思った以上に積み重なります。

白黒家計簿は、従来の家計簿アプリが苦手な人のために作りました。

白黒家計簿の特長

ストレスフリーな記録
金額と内容を入れて完了——約3秒。複雑なカテゴリも、しつこいリマインダーも、開いた瞬間に閉じたくなる画面もありません。

気づかない支出を見える化
少額ほど見落とされがち。記録すれば、今月どれだけ静かに減ったかがはっきりわかります。

サブスクの罠を把握
定期課金を支出として残し、月次サマリーで「払い続けていた」サブスクを見つけます。

プライバシー優先
オフラインで使えます。データは端末内に保存。

シンプルな統計
日・週・月・年——支出の傾向が一目でわかります。

ダークモード
システム設定に追従。夜の記録も目にやさしい。

オプションの Pro
クラウド同期で家計をバックアップ。機種変更後も安心。

16言語対応
${LANG_LIST}

見落としがちな支出から、お金の主導権を取り戻しましょう。

白黒家計簿をダウンロードして、本当のお金の流れに気づき始めましょう。`,
};

const KO = {
  name: "흑백가계부",
  subtitle: "마찰 없는 지출 기록",
  promotional_text:
    "큰 지출은 없는데 잔고가 줄었다? 커피·배달·구독을 3초 만에 기록. 미니멀, 기기 저장, 잔소리 없음.",
  keywords:
    "가계부,지출,예산,절약,구독,돈,회계,가계관리,심플,프라이빗,소비추적",
  release_notes:
    "흑백가계부를 이용해 주셔서 감사합니다. 이번 업데이트는 성능 개선, 버그 수정, 언어 지원 확장을 포함합니다.",
  description: `돈은 어디로 갔을까요?

큰 소비는 없었는데도 잔고는 줄었습니다. 커피, 배달, 자동 갱신 구독——잊기 쉬운 작은 결제가 생각보다 많이 쌓입니다.

흑백가계부는 복잡한 가계부 앱이 싫은 사람을 위해 만들었습니다.

흑백가계부를 고르는 이유

마찰 없는 기록
금액과 내용만 입력하면 끝——약 3초. 복잡한 카테고리도, 성가신 알림도, 열자마자 끄고 싶은 화면도 없습니다.

놓치기 쉬운 소비를 포착
소액일수록 잊기 쉽습니다. 기록하면 이번 달 조용히 빠져나간 금액을 바로 볼 수 있습니다.

구독 함정을 확인
정기 결제를 지출로 남기고, 월별 요약으로 잊고 있던 구독을 찾아냅니다.

기본은 프라이빗
오프라인에서도 사용. 데이터는 기기에 저장됩니다.

간단한 통계
일·주·월·년——소비 패턴을 한눈에.

다크 모드
시스템 설정을 따릅니다. 밤에도 눈이 편합니다.

선택적 Pro
클라우드 동기화로 장부를 백업하고, 기기를 바꿔도 유지합니다.

16개 언어
${LANG_LIST}

놓치던 지출부터 보이기 시작할 때, 돈의 주도권을 되찾으세요.

흑백가계부를 다운로드하고, 돈이 진짜 어디로 가는지 확인해 보세요.`,
};

const ES = {
  name: "Contabilidad B/N",
  subtitle: "Gastos sin fricción",
  promotional_text:
    "¿Sin grandes compras y el saldo baja? Anota cualquier gasto en tres segundos. Mínima, privada y sin avisos molestos.",
  keywords:
    "gastos,presupuesto,dinero,finanzas,ahorro,contabilidad,suscripción,tracker,ledger,libro",
  release_notes:
    "¡Gracias por usar Contabilidad B/N! Esta actualización incluye mejoras de rendimiento, correcciones y más idiomas.",
  description: `¿A dónde se fue el dinero?

Este mes no hubo grandes compras, pero el saldo bajó. Cafés, delivery y suscripciones que se renuevan solas: esos cargos pequeños y olvidables suman mucho más de lo que crees.

Contabilidad B/N está hecha para quienes odian las apps de gastos tradicionales.

¿Por qué Contabilidad B/N?

Registro sin fricción
Importe, descripción y listo — en unos tres segundos. Sin categorías complicadas, sin recordatorios molestos, sin una pantalla que quieras cerrar al abrirla.

Detecta lo que no notas
Los gastos pequeños son los más fáciles de pasar por alto. Anótalos y verás cuánto se filtró en silencio este mes.

La trampa de las suscripciones
Registra cargos recurrentes como gastos y deja que el resumen mensual muestre las suscripciones que seguías pagando sin darte cuenta.

Privacidad por defecto
Funciona sin conexión. Tus datos se guardan en el dispositivo.

Estadísticas simples
Por día, semana, mes o año: tus patrones de gasto de un vistazo.

Modo oscuro
Sigue la apariencia del sistema; cómodo de noche.

Pro opcional
Desbloquea la sincronización en la nube para respaldar tu libro y conservarlo al cambiar de móvil.

16 idiomas
${LANG_LIST}

Recupera el control de tu dinero — empezando por ver cada gasto que normalmente se te escapa.

Descarga Contabilidad B/N y empieza a notar a dónde va de verdad tu dinero.`,
};

const FR = {
  name: "Compta Noir & Blanc",
  subtitle: "Dépenses sans friction",
  promotional_text:
    "Pas de gros achats, et pourtant le solde baisse ? Notez une dépense en trois secondes. Minimal, privé, sans relances.",
  keywords:
    "dépenses,budget,argent,finance,épargne,comptabilité,abonnement,suivi,livre,gestion",
  release_notes:
    "Merci d'utiliser Compta Noir & Blanc ! Cette mise à jour apporte des performances, des correctifs et plus de langues.",
  description: `Où est passé l'argent ?

Pas de gros achats ce mois-ci, et pourtant le solde a baissé. Cafés, livraisons et abonnements à renouvellement auto — ces petits montants oubliables s'additionnent bien plus qu'on ne croit.

Compta Noir & Blanc est faite pour ceux qui détestent les apps de dépenses classiques.

Pourquoi Compta Noir & Blanc ?

Saisie sans friction
Montant, description, terminé — en environ trois secondes. Pas de catégories complexes, pas de rappels collants, pas d'écran qu'on a envie de fermer aussitôt ouvert.

Repérez ce que vous ne voyez pas
Les petits achats passent le plus facilement. Notez-les et voyez exactement ce qui s'est échappé ce mois-ci.

Le piège des abonnements
Enregistrez les prélèvements récurrents et laissez le résumé mensuel faire apparaître les abonnements que vous payiez encore sans y penser.

Privé par défaut
Fonctionne hors ligne. Vos données restent sur l'appareil.

Statistiques simples
Par jour, semaine, mois ou année — vos habitudes de dépense d'un coup d'œil.

Mode sombre
Suit l'apparence du système, agréable la nuit.

Pro en option
Débloquez la synchro cloud pour sauvegarder votre livre et le garder en changeant de téléphone.

16 langues
${LANG_LIST}

Reprenez le contrôle de votre argent — en voyant chaque dépense que vous auriez manquée.

Téléchargez Compta Noir & Blanc et commencez à voir où va vraiment votre argent.`,
};

const DE = {
  name: "SchwarzWeiß Finanzen",
  subtitle: "Ausgaben ohne Reibung",
  promotional_text:
    "Keine großen Käufe — und doch weniger Guthaben? Jede Ausgabe in drei Sekunden. Minimal, privat, ohne Nörgeln.",
  keywords:
    "ausgaben,budget,geld,finanzen,sparen,buchhaltung,abo,tracker,haushalt,kosten",
  release_notes:
    "Danke, dass du SchwarzWeiß Finanzen nutzt! Dieses Update bringt Performance, Fehlerbehebungen und mehr Sprachen.",
  description: `Wohin ist das Geld?

Keine großen Käufe in diesem Monat — und trotzdem weniger auf dem Konto. Kaffee, Lieferungen und sich selbst erneuernde Abos: Diese kleinen, vergessenen Beträge summieren sich stärker, als du denkst.

SchwarzWeiß Finanzen ist für alle, die klassische Ausgaben-Apps hassen.

Warum SchwarzWeiß Finanzen?

Reibungsloses Erfassen
Betrag, Beschreibung, fertig — in etwa drei Sekunden. Keine komplizierten Kategorien, keine nervigen Erinnerungen, kein Bildschirm, den du sofort schließen willst.

Erkenne Ausgaben, die du übersiehst
Kleine Käufe vergisst man am leichtesten. Erfasse sie und sieh, wie viel diesen Monat still verschwunden ist.

Die Abo-Falle sehen
Trage wiederkehrende Kosten als Ausgaben ein — die Monatsübersicht zeigt Abos, die du noch zahlst, ohne es zu merken.

Privat standardmäßig
Funktioniert offline. Deine Daten bleiben auf dem Gerät.

Einfache Statistiken
Nach Tag, Woche, Monat oder Jahr — deine Muster auf einen Blick.

Dunkelmodus
Folgt dem Systemdesign, angenehm nachts.

Optionales Pro
Schalte Cloud-Sync frei, um dein Buch zu sichern und beim Handywechsel zu behalten.

16 Sprachen
${LANG_LIST}

Hol dir die Kontrolle über dein Geld zurück — indem du jede Ausgabe siehst, die sonst untergeht.

Lade SchwarzWeiß Finanzen und fang an zu merken, wohin dein Geld wirklich fließt.`,
};

const IT = {
  name: "Conti Bianco Nero",
  subtitle: "Spese senza attrito",
  promotional_text:
    "Niente grandi acquisti e il saldo scende? Registra una spesa in tre secondi. Minimale, privata, senza sollecitazioni.",
  keywords:
    "spese,budget,denaro,finanze,risparmio,contabilità,abbonamento,tracker,registro,soldi",
  release_notes:
    "Grazie per usare Conti Bianco Nero! Questo aggiornamento porta prestazioni, correzioni e più lingue.",
  description: `Dove sono finiti i soldi?

Niente grandi acquisti questo mese, eppure il saldo è calato. Caffè, delivery e abbonamenti che si rinnovano da soli: queste piccole spese dimenticabili sommano molto più di quanto pensi.

Conti Bianco Nero è pensata per chi odia le app di spese tradizionali.

Perché Conti Bianco Nero?

Registrazione senza attrito
Importo, descrizione, fatto — in circa tre secondi. Niente categorie complicate, niente promemoria insistenti, niente schermata da chiudere appena aperta.

Scova ciò che non noti
Le piccole spese sono le più facili da perdere. Registrale e vedi quanto è filtrato via in silenzio questo mese.

La trappola degli abbonamenti
Segna i costi ricorrenti come spese e lascia che il riepilogo mensile mostri gli abbonamenti che stavi ancora pagando.

Privata di default
Funziona offline. I dati restano sul dispositivo.

Statistiche semplici
Per giorno, settimana, mese o anno — i tuoi pattern a colpo d'occhio.

Modalità scura
Segue l'aspetto di sistema, comoda di notte.

Pro opzionale
Sblocca la sync cloud per eseguire il backup del registro e tenerlo cambiando telefono.

16 lingue
${LANG_LIST}

Riprendi il controllo dei soldi — iniziando a vedere ogni spesa che di solito ti sfugge.

Scarica Conti Bianco Nero e inizia a notare dove vanno davvero i tuoi soldi.`,
};

const PT = {
  name: "Conta Preto e Branco",
  subtitle: "Gastos sem atrito",
  promotional_text:
    "Sem grandes compras e o saldo caiu? Lance qualquer gasto em três segundos. Minimalista, privada e sem cobranças.",
  keywords:
    "gastos,orçamento,dinheiro,finanças,economia,contabilidade,assinatura,controle,despesas,poupança",
  release_notes:
    "Obrigado por usar Conta Preto e Branco! Esta atualização traz desempenho, correções e mais idiomas.",
  description: `Para onde foi o dinheiro?

Sem grandes compras este mês, e mesmo assim o saldo caiu. Cafés, delivery e assinaturas que renovam sozinhas — esses pequenos lançamentos esquecíveis somam bem mais do que você imagina.

Conta Preto e Branco é feita para quem odeia apps de gastos tradicionais.

Por que Conta Preto e Branco?

Lançamento sem atrito
Valor, descrição, pronto — em cerca de três segundos. Sem categorias complicadas, sem lembretes chatos, sem tela que dá vontade de fechar na hora.

Pegue o que você não nota
Gastos pequenos são os mais fáceis de ignorar. Lance-os e veja quanto vazou em silêncio neste mês.

A armadilha das assinaturas
Registre cobranças recorrentes como gastos e deixe o resumo mensal mostrar as assinaturas que você ainda pagava.

Privada por padrão
Funciona offline. Seus dados ficam no aparelho.

Estatísticas simples
Por dia, semana, mês ou ano — seus padrões de gasto de um olhar.

Modo escuro
Segue a aparência do sistema; confortável à noite.

Pro opcional
Desbloqueie a sincronização na nuvem para fazer backup do livro e mantê-lo ao trocar de celular.

16 idiomas
${LANG_LIST}

Retome o controle do seu dinheiro — começando por ver cada gasto que normalmente passa batido.

Baixe Conta Preto e Branco e comece a notar para onde o dinheiro realmente vai.`,
};

const RU = {
  name: "Чёрно-белый учёт",
  subtitle: "Расходы без трения",
  promotional_text:
    "Крупных покупок нет, а баланс тает? Любой расход за три секунды. Минимум, на устройстве, без напоминаний.",
  keywords:
    "расходы,бюджет,деньги,финансы,учёт,подписка,экономия,трекер,книга,кошелёк",
  release_notes:
    "Спасибо, что пользуетесь «Чёрно-белый учёт»! В этом обновлении — скорость, исправления и больше языков.",
  description: `Куда ушли деньги?

Крупных покупок в этом месяце не было, а баланс всё равно уменьшился. Кофе, доставка и автопродление подписок — мелкие, забываемые списания складываются куда сильнее, чем кажется.

«Чёрно-белый учёт» создан для тех, кто ненавидит обычные приложения учёта расходов.

Почему «Чёрно-белый учёт»?

Запись без трения
Сумма, описание — готово примерно за три секунды. Без сложных категорий, навязчивых напоминаний и экрана, который хочется закрыть сразу.

Ловите то, что не замечаете
Мелкие траты проще всего упустить. Запишите их и увидите, сколько тихо утекло за месяц.

Ловушка подписок
Фиксируйте регулярные списания как расходы — месячная сводка покажет подписки, которые вы всё ещё оплачивали.

Приватность по умолчанию
Работает офлайн. Данные хранятся на устройстве.

Простая статистика
По дням, неделям, месяцам или годам — ваши привычки с первого взгляда.

Тёмная тема
Следует системному оформлению, комфортна ночью.

Опциональный Pro
Откройте облачную синхронизацию, чтобы сохранить книгу и не потерять её при смене телефона.

16 языков
${LANG_LIST}

Верните контроль над деньгами — начните с расходов, которые обычно ускользают.

Скачайте «Чёрно-белый учёт» и начните замечать, куда на самом деле уходят деньги.`,
};

const HI = {
  name: "ब्लैक व्हाइट हिसाब",
  subtitle: "बिना झंझट खर्च ट्रैक",
  promotional_text:
    "बड़ी खरीद नहीं, फिर भी बैलेंस घटा? कोई भी खर्च तीन सेकंड में लिखें। सरल, निजी, बिना परेशान किए।",
  keywords:
    "खर्च,बजट,पैसे,वित्त,बचत,हिसाब,सब्सक्रिप्शन,ट्रैकर,खाता,लेखा",
  release_notes:
    "ब्लैक व्हाइट हिसाब इस्तेमाल करने के लिए धन्यवाद! इस अपडेट में प्रदर्शन सुधार, बग फिक्स और अधिक भाषाएँ हैं।",
  description: `पैसे कहाँ गए?

इस महीने कोई बड़ी खरीद नहीं, फिर भी बैलेंस घट गया। कॉफ़ी, डिलीवरी और अपने-आप नवीनीकृत सब्सक्रिप्शन — ये छोटे, भूल जाने वाले खर्च आपकी सोच से कहीं ज़्यादा जुड़ जाते हैं।

ब्लैक व्हाइट हिसाब उन लोगों के लिए है जिन्हें पारंपरिक खर्च ऐप्स पसंद नहीं।

क्यों ब्लैक व्हाइट हिसाब?

बिना झंझट रिकॉर्ड
राशि, विवरण, हो गया — लगभग तीन सेकंड में। जटिल श्रेणियाँ नहीं, परेशान करने वाले रिमाइंडर नहीं, खोलते ही बंद करने वाला स्क्रीन नहीं।

जो नज़र नहीं आता, उसे पकड़ें
छोटे खर्च सबसे आसानी से छूटते हैं। लिखें और देखें कि इस महीने चुपचाप कितना निकल गया।

सब्सक्रिप्शन का जाल
आवर्ती कटौती को खर्च के रूप में रखें — मासिक सारांश उन सब्सक्रिप्शन को दिखाएगा जो आप भूलकर भी चुका रहे थे।

डिफ़ॉल्ट रूप से निजी
ऑफ़लाइन काम करता है। डेटा आपके डिवाइस पर रहता है।

सरल आँकड़े
दिन, सप्ताह, महीने या साल — खर्च की आदतें एक नज़र में।

डार्क मोड
सिस्टम दिखावट के अनुसार; रात में आँखों के अनुकूल।

वैकल्पिक Pro
क्लाउड सिंक से बही का बैकअप लें और फ़ोन बदलने पर भी रखें।

16 भाषाएँ
${LANG_LIST}

अपने पैसे पर नियंत्रण वापस लें — उन खर्चों से शुरू करें जो आमतौर पर छूट जाते हैं।

ब्लैक व्हाइट हिसाब डाउनलोड करें और देखना शुरू करें कि आपके पैसे सच में कहाँ जाते हैं।`,
};

const ID = {
  name: "Akuntansi Hitam Putih",
  subtitle: "Catat belanja tanpa ribet",
  promotional_text:
    "Tak ada belanja besar, saldo tetap turun? Catat pengeluaran dalam tiga detik. Minimal, privat, tanpa mengganggu.",
  keywords:
    "pengeluaran,anggaran,uang,keuangan,tabungan,akuntansi,langganan,tracker,buku,biaya",
  release_notes:
    "Terima kasih memakai Akuntansi Hitam Putih! Pembaruan ini membawa performa, perbaikan bug, dan lebih banyak bahasa.",
  description: `Uang pergi ke mana?

Tidak ada belanja besar bulan ini, tapi saldo tetap menyusut. Kopi, pengantaran, dan langganan yang diperpanjang otomatis — biaya kecil yang mudah dilupakan bertambah jauh lebih besar dari dugaanmu.

Akuntansi Hitam Putih dibuat untuk orang yang benci aplikasi pengeluaran biasa.

Mengapa Akuntansi Hitam Putih?

Pencatatan tanpa gesekan
Jumlah, deskripsi, selesai — sekitar tiga detik. Tanpa kategori rumit, tanpa pengingat mengganggu, tanpa layar yang ingin langsung ditutup.

Tangkap yang tak sempat kamu sadari
Belanja kecil paling mudah terlewat. Catat dan lihat berapa yang diam-diam bocor bulan ini.

Jebakan langganan
Catat tagihan berulang sebagai pengeluaran — ringkasan bulanan menampilkan langganan yang masih kamu bayar tanpa sadar.

Privat secara bawaan
Bisa offline. Datamu disimpan di perangkat.

Statistik sederhana
Per hari, minggu, bulan, atau tahun — pola belanja sekilas.

Mode gelap
Mengikuti tampilan sistem, nyaman di malam hari.

Pro opsional
Buka sinkronisasi cloud untuk cadangkan buku dan tetap aman saat ganti ponsel.

16 bahasa
${LANG_LIST}

Ambil kembali kendali uangmu — mulai dari melihat setiap pengeluaran yang biasanya terlewat.

Unduh Akuntansi Hitam Putih dan mulai perhatikan ke mana uangmu benar-benar pergi.`,
};

const VI = {
  name: "Sổ Đen Trắng",
  subtitle: "Ghi chi tiêu không ma sát",
  promotional_text:
    "Không mua lớn mà số dư vẫn giảm? Ghi mọi khoản trong ba giây. Tối giản, riêng tư, không làm phiền.",
  keywords:
    "chi tiêu,ngân sách,tiền,tài chính,tiết kiệm,kế toán,đăng ký,theo dõi,sổ sách,chi phí",
  release_notes:
    "Cảm ơn bạn đã dùng Sổ Đen Trắng! Bản cập nhật này cải thiện hiệu năng, sửa lỗi và mở rộng ngôn ngữ.",
  description: `Tiền đi đâu rồi?

Tháng này không mua gì lớn, vậy mà số dư vẫn giảm. Cà phê, giao hàng và gói đăng ký tự gia hạn — những khoản nhỏ dễ quên cộng lại nhiều hơn bạn nghĩ.

Sổ Đen Trắng dành cho người ghét app chi tiêu truyền thống.

Vì sao chọn Sổ Đen Trắng?

Ghi nhanh không ma sát
Số tiền, mô tả, xong — khoảng ba giây. Không danh mục phức tạp, không nhắc nhở dai dẳng, không màn hình muốn đóng ngay khi mở.

Bắt được khoản bạn không để ý
Chi nhỏ dễ bị bỏ qua nhất. Ghi lại để thấy tháng này đã “rò” bao nhiêu trong im lặng.

Bẫy đăng ký
Ghi các khoản định kỳ thành chi tiêu — tóm tắt tháng sẽ lộ những gói bạn vẫn đang trả mà quên.

Riêng tư mặc định
Dùng offline được. Dữ liệu lưu trên máy.

Thống kê đơn giản
Theo ngày, tuần, tháng hoặc năm — thói quen chi tiêu nhìn một cái là rõ.

Chế độ tối
Theo giao diện hệ thống, dễ chịu về đêm.

Pro tùy chọn
Mở đồng bộ đám mây để sao lưu sổ và giữ khi đổi máy.

16 ngôn ngữ
${LANG_LIST}

Lấy lại quyền kiểm soát tiền bạc — bắt đầu từ những khoản thường bị bỏ sót.

Tải Sổ Đen Trắng và bắt đầu nhận ra tiền thật sự đi đâu.`,
};

const TH = {
  name: "บัญชีขาวดำ",
  subtitle: "จดรายจ่ายไร้แรงเสียดทาน",
  promotional_text:
    "ไม่ได้ซื้อของใหญ่ ทำไมยอดลด? จดรายจ่ายในสามวินาที มินิมอล ส่วนตัว ไม่กวนใจ",
  keywords:
    "รายจ่าย,งบประมาณ,เงิน,การเงิน,ออม,บัญชี,สมาชิก,ติดตาม,สมุดบัญชี,ค่าใช้จ่าย",
  release_notes:
    "ขอบคุณที่ใช้บัญชีขาวดำ! อัปเดตนี้ปรับปรุงประสิทธิภาพ แก้บั๊ก และรองรับภาษาเพิ่ม",
  description: `เงินหายไปไหน?

เดือนนี้ไม่ได้ซื้อของใหญ่ แต่ยอดเงินยังลด กาแฟ ส่งอาหาร และสมาชิกที่ต่ออายุเอง — ค่าใช้จ่ายเล็ก ๆ ที่ลืมง่าย รวมกันมากกว่าที่คิด

บัญชีขาวดำ สร้างเพื่อคนที่เกลียดแอปจดรายจ่ายแบบเดิม

ทำไมต้องบัญชีขาวดำ?

จดเร็วไร้แรงเสียดทาน
จำนวน คำอธิบาย เสร็จ — ประมาณสามวินาที ไม่มีหมวดซับซ้อน ไม่มีการเตือนกวนใจ ไม่มีหน้าจอที่อยากปิดทันทีที่เปิด

จับรายจ่ายที่มองไม่เห็น
ของเล็กมักหลุดง่ายที่สุด จดไว้แล้วดูว่าเดือนนี้รั่วไหลเงียบ ๆ ไปเท่าไร

กับดักสมาชิก
บันทึกค่าใช้จ่ายซ้ำเป็นรายจ่าย ให้สรุปรายเดือนโชว์สมาชิกที่คุณยังจ่ายอยู่โดยไม่รู้ตัว

ความเป็นส่วนตัวเป็นค่าเริ่มต้น
ใช้แบบออฟไลน์ได้ ข้อมูลเก็บในเครื่อง

สถิติเรียบง่าย
รายวัน สัปดาห์ เดือน หรือปี — รูปแบบการใช้จ่ายเห็นชัดในพริบตา

โหมดมืด
ตามระบบ ใช้ง่ายตอนกลางคืน

Pro เสริม
ปลดล็อกซิงก์คลาวด์ สำรองสมุดบัญชี และเก็บไว้เมื่อเปลี่ยนมือถือ

รองรับ 16 ภาษา
${LANG_LIST}

ทวงคืนการควบคุมเงินของคุณ — เริ่มจากเห็นทุกรายจ่ายที่มักหลุด

ดาวน์โหลดบัญชีขาวดำ แล้วเริ่มสังเกตว่าเงินไปไหนจริง ๆ`,
};

const TR = {
  name: "Siyah Beyaz Muhasebe",
  subtitle: "Sürtünmesiz harcama takibi",
  promotional_text:
    "Büyük alışveriş yok ama bakiye düştü? Her harcamayı üç saniyede kaydet. Sade, özel, rahatsız etmez.",
  keywords:
    "harcama,bütçe,para,finans,tasarruf,muhasebe,abonelik,takip,defter,gider",
  release_notes:
    "Siyah Beyaz Muhasebe kullandığınız için teşekkürler! Bu güncellemede performans, hata düzeltmeleri ve daha fazla dil var.",
  description: `Para nereye gitti?

Bu ay büyük alışveriş yoktu ama bakiye yine düştü. Kahveler, teslimatlar ve otomatik yenilenen abonelikler — unutulması kolay küçük tutarlar sandığınızdan çok daha fazla birikir.

Siyah Beyaz Muhasebe, klasik harcama uygulamalarından nefret edenler için yapıldı.

Neden Siyah Beyaz Muhasebe?

Sürtünmesiz kayıt
Tutar, açıklama, bitti — yaklaşık üç saniyede. Karmaşık kategoriler yok, rahatsız edici hatırlatmalar yok, açar açmaz kapatmak istediğiniz ekran yok.

Fark etmediğin harcamaları yakala
Küçük alışverişler en kolay gözden kaçar. Kaydet ve bu ay sessizce ne kadar sızdığını gör.

Abonelik tuzağı
Tekrarlayan ücretleri gider olarak yaz; aylık özet, hâlâ ödediğin abonelikleri ortaya çıkarır.

Varsayılan olarak özel
Çevrimdışı çalışır. Verilerin cihazda kalır.

Basit istatistikler
Gün, hafta, ay veya yıl — harcama alışkanlıkların bir bakışta.

Karanlık mod
Sistem görünümünü izler; geceleri göz yormaz.

İsteğe bağlı Pro
Bulut senkronu ile defterini yedekle, telefon değiştirince de koru.

16 dil
${LANG_LIST}

Paranın kontrolünü geri al — genellikle kaçırdığın her harcamayı görmeye başlayarak.

Siyah Beyaz Muhasebe'yi indir ve paranızın gerçekten nereye gittiğini fark etmeye başla.`,
};

const PL = {
  name: "Czarno-białe finanse",
  subtitle: "Wydatki bez tarcia",
  promotional_text:
    "Bez dużych zakupów, a saldo spada? Zapisz wydatek w trzy sekundy. Minimalnie, prywatnie, bez nękania.",
  keywords:
    "wydatki,budżet,pieniądze,finanse,oszczędności,księgowość,subskrypcja,tracker,ledger,koszty",
  release_notes:
    "Dziękujemy za korzystanie z Czarno-białe finanse! Ta aktualizacja daje wydajność, poprawki i więcej języków.",
  description: `Gdzie podziały się pieniądze?

W tym miesiącu bez dużych zakupów, a saldo i tak spadło. Kawy, dostawy i automatycznie odnawiane subskrypcje — te drobne, łatwe do zapomnienia kwoty sumują się mocniej, niż myślisz.

Czarno-białe finanse powstały dla osób, które nienawidzą klasycznych aplikacji do wydatków.

Dlaczego Czarno-białe finanse?

Zapis bez tarcia
Kwota, opis, gotowe — w około trzy sekundy. Bez skomplikowanych kategorii, bez natrętnych przypomnień, bez ekranu, który chcesz zamknąć zaraz po otwarciu.

Złap to, czego nie zauważasz
Małe zakupy najłatwiej przeoczyć. Zapisz je i zobacz, ile w tym miesiącu cicho „wyciekało”.

Pułapka subskrypcji
Zapisuj cykliczne opłaty jako wydatki — miesięczne podsumowanie pokaże subskrypcje, które wciąż płaciłeś.

Prywatność domyślnie
Działa offline. Dane zostają na urządzeniu.

Proste statystyki
Dzień, tydzień, miesiąc lub rok — wzorce wydatków w jednym rzucie oka.

Tryb ciemny
Podąża za wyglądem systemu; wygodny w nocy.

Opcjonalne Pro
Odblokuj synchronizację w chmurze, by zrobić kopię księgi i zachować ją przy zmianie telefonu.

16 języków
${LANG_LIST}

Odzyskaj kontrolę nad pieniędzmi — zaczynając od wydatków, które zwykle umykają.

Pobierz Czarno-białe finanse i zacznij zauważać, dokąd naprawdę idą twoje pieniądze.`,
};

// Map ASC locale codes to native copy objects.
const LOCALES = [
  { asc: "en-US", copy: EN },
  { asc: "zh-Hant", copy: ZH },
  { asc: "ja", copy: JA },
  { asc: "ko", copy: KO },
  { asc: "es-ES", copy: ES },
  { asc: "fr-FR", copy: FR },
  { asc: "de-DE", copy: DE },
  { asc: "it", copy: IT },
  { asc: "pt-BR", copy: PT },
  { asc: "ru", copy: RU },
  { asc: "hi", copy: HI },
  { asc: "id", copy: ID },
  { asc: "vi", copy: VI },
  { asc: "th", copy: TH },
  { asc: "tr", copy: TR },
  { asc: "pl", copy: PL },
];

// Per-locale metadata files deliver understands.
const PER_LOCALE_FILES = [
  "name",
  "subtitle",
  "promotional_text",
  "description",
  "keywords",
  "release_notes",
];

// App-level (not per-locale) metadata. Edit freely; see Apple's category keys.
const GLOBAL_FILES = {
  "copyright.txt": "2026 zii",
  "primary_category.txt": "FINANCE",
  "secondary_category.txt": "PRODUCTIVITY",
};

// ---------------------------------------------------------------------------
// Apple field limits — validated so a push can't be rejected on length.
// ---------------------------------------------------------------------------
const LIMITS = { name: 30, subtitle: 30, promotional_text: 170, keywords: 100 };

// ---------------------------------------------------------------------------

let created = 0;
let skipped = 0;
const problems = [];

function write(path, contents) {
  if (existsSync(path) && !FORCE) {
    skipped++;
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents.endsWith("\n") ? contents : contents + "\n");
  created++;
}

for (const { asc, copy } of LOCALES) {
  for (const [field, limit] of Object.entries(LIMITS)) {
    const value = copy[field];
    if (value && [...value].length > limit) {
      problems.push(
        `${asc}/${field}: ${[...value].length} chars (limit ${limit})`,
      );
    }
  }
  for (const field of PER_LOCALE_FILES) {
    write(join(METADATA_DIR, asc, `${field}.txt`), copy[field]);
  }
  write(join(METADATA_DIR, asc, "support_url.txt"), SUPPORT_URL);
}

for (const [file, value] of Object.entries(GLOBAL_FILES)) {
  write(join(METADATA_DIR, file), value);
}

// App Review notes live outside metadata/ so deliver does not PATCH incomplete
// contact fields. Restore under metadata/review_information/ only when
// first_name, last_name, email_address, and phone_number are also present.
write(
  join(ROOT, "fastlane", "review_information.local", "notes.txt"),
  `Black White Accounting is a local-first expense tracker.

- No account is required to use core features; data is stored on-device.
- Sign in with Apple is optional and only gates the paid cloud-sync backup.
- The Pro upgrade (cloud sync) is a RevenueCat in-app purchase; use a sandbox tester to review it.
- Speech recognition / microphone are used only for dictating expense descriptions.`,
);

console.log(`\nApp Store metadata: ${created} file(s) written, ${skipped} kept.`);
console.log(`Location: fastlane/metadata/`);
if (problems.length) {
  console.error(`\nField-length problems (fix before pushing):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exitCode = 1;
}
