// 新規登録者への自動サンクスメールの既定文面。
//
// この定数は DB に保存された編集版が無いときのフォールバックであり、
// /sales-ai/compose の「新規登録サンクスメール」パネルの初期値でもある。
// 実際に送られる文面は src/lib/thanksEmail.ts の getThanksEmailConfig()
// が返すもの（DB優先）。
//
// 使える差込変数は登録直後のWEBRIS Organizationから確実に取れるものだけ:
//   {{company}}         会社名（Organization名）
//   {{sender}}          差出人名
//   {{webris_url}}      WEBRISのURL
//   {{company_address}} LEVANの社名・住所（特定電子メール法の法定表示）
// サイト解析系（{{tools}} / {{seoGap}} など）は登録時点で無いので使わない。

export const THANKS_EMAIL_ALLOWED_TOKENS = [
  "{{company}}",
  "{{sender}}",
  "{{webris_url}}",
  "{{company_address}}",
] as const;

export const THANKS_EMAIL_DEFAULT_SUBJECT =
  "WEBRISへのご登録ありがとうございます｜プランのご案内";

export const THANKS_EMAIL_DEFAULT_BODY = `<div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#111111">

  <div style="background:#ffffff;padding:20px;text-align:center;border-bottom:1px solid #e5e5e7">
    <img src="https://hub.levan.jp/mail/logo_01.png" alt="WEBRIS" width="175" height="32" style="display:block;margin:0 auto;border:0">
  </div>

  <img src="https://hub.levan.jp/mail/hero_01.jpg" alt="AIが、あなたのWebサイトを分析しSEOの成長をサポートします" width="600" height="400" style="display:block;width:100%;max-width:600px;height:auto;border:0">

  <div style="padding:28px 24px;font-size:14px;line-height:1.9">

    <p>{{company}} ご担当者様</p>

    <p>この度はWEBRISにご登録いただきありがとうございます。<br>
    株式会社LEVANの{{sender}}と申します。</p>

    <p>WEBRISは、AIがあなたのWebサイトを分析し、<strong>SEOの現状の可視化</strong>から
    <strong>競合サイトとの差の発見</strong>、<strong>改善提案</strong>までを自動で行うツールです。
    まずは無料プランのまま、サイトのSEO分析をお試しください。</p>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto">
      <tr><td style="background:#1d1d1f;border-radius:8px">
        <a href="{{webris_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">WEBRISでSEO分析する</a>
      </td></tr>
    </table>

    <hr style="border:none;border-top:1px solid #dddddd;margin:32px 0">

    <p style="font-size:16px;font-weight:bold;margin:0 0 4px">もっと活用するなら、有料プランへ</p>
    <p style="margin-top:0">分析できるページ数・キーワード数・競合サイト数を広げ、ヒートマップや定期レポートも使えるようになります。</p>

    <div style="border:1px solid #e5e5e7;border-radius:10px;padding:16px 18px;margin:16px 0">
      <div style="font-weight:bold;font-size:15px">スタンダードプラン<span style="font-weight:normal;color:#555555;font-size:13px"> — 月額 &yen;3,800</span></div>
      <div style="font-size:13px;color:#555555;margin-top:6px">本格的にSEO改善を始めたい方に。主要ページの分析と改善提案をひと通りカバーします。</div>
    </div>

    <div style="border:1px solid #0071e3;border-radius:10px;padding:16px 18px;margin:16px 0;background:#f5f9ff">
      <div style="font-weight:bold;font-size:15px">プロプラン<span style="font-weight:normal;color:#555555;font-size:13px"> — 月額 &yen;19,800</span> <span style="background:#0071e3;color:#ffffff;font-size:11px;padding:2px 8px;border-radius:10px;margin-left:6px">おすすめ</span></div>
      <div style="font-size:13px;color:#555555;margin-top:6px">サイト全体を継続的に運用したい方に。競合比較・ヒートマップ・定期レポートで改善サイクルを回せます。</div>
    </div>

    <div style="border:1px solid #e5e5e7;border-radius:10px;padding:16px 18px;margin:16px 0">
      <div style="font-weight:bold;font-size:15px">ビジネスプラン<span style="font-weight:normal;color:#555555;font-size:13px"> — 月額 &yen;38,000</span></div>
      <div style="font-size:13px;color:#555555;margin-top:6px">複数サイト・大規模サイトの運用や、チームでのご利用に。分析上限を大きく拡張します。</div>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto">
      <tr><td style="background:#0071e3;border-radius:8px">
        <a href="{{webris_url}}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">プランを詳しく見る</a>
      </td></tr>
    </table>

    <div style="background:#fbf8e8;padding:16px 20px;margin:24px 0;font-size:13px;line-height:1.9;color:#555555">
      &#8251; 料金・プラン内容は変更される場合があります。最新の内容はWEBRISのプランページをご確認ください<br>
      &#8251; 無料プランのままでもご利用いただけます<br>
      &#8251; プランはいつでも変更・解約できます<br>
      &#8251; ご不明な点は本メールへのご返信でお問い合わせいただけます
    </div>

    <hr style="border:none;border-top:1px solid #dddddd;margin:28px 0">
    <p style="font-size:12px;color:#666666;line-height:1.7">
      {{company_address}}<br>
      WEBRIS {{sender}}<br>
      配信停止をご希望の場合は、本メールにご返信いただければ以後お送りいたしません。
    </p>

  </div>
</div>`;
