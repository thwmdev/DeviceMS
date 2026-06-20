"""
Email service cho DeviceMS — gửi thông báo kết quả yêu cầu cấp phát/thu hồi.
Sử dụng Gmail SMTP với App Password qua biến môi trường.
Email được gửi bất đồng bộ (thread riêng) để không block API response.
"""
import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime


import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587

def _request_type_label(loai_yeu_cau: str) -> str:
    if loai_yeu_cau == "CAP_PHAT":
        return "Cấp phát thiết bị"
    if loai_yeu_cau == "THU_HOI":
        return "Thu hồi thiết bị"
    return loai_yeu_cau


def _build_html(
    ho_ten: str,
    request_id: int,
    loai_yeu_cau: str,
    ten_thiet_bi: str,
    decision: str,          # "approved" | "rejected"
    reviewer: str,
    note: str,
    ngay_duyet: str,
) -> str:
    loai_label = _request_type_label(loai_yeu_cau)

    if decision == "approved":
        decision_label = "✅ CHẤP NHẬN"
        decision_color = "#2f7654"
        decision_bg = "#eaf7f1"
        message = (
            f"Yêu cầu <strong>{loai_label}</strong> của bạn đã được <strong>chấp nhận</strong>. "
            "Vui lòng liên hệ bộ phận quản lý thiết bị để hoàn tất thủ tục."
        )
    else:
        decision_label = "❌ TỪ CHỐI"
        decision_color = "#b4433b"
        decision_bg = "#fdf1f0"
        message = (
            f"Yêu cầu <strong>{loai_label}</strong> của bạn đã bị <strong>từ chối</strong>. "
            "Vui lòng liên hệ quản lý để biết thêm chi tiết hoặc gửi lại yêu cầu."
        )

    note_row = ""
    if note and note.strip():
        note_row = f"""
        <tr>
          <td style="padding:8px 0; color:#64706f; font-size:13px; border-bottom:1px solid #ede8e0;">
            Ghi chú
          </td>
          <td style="padding:8px 0; font-size:13px; border-bottom:1px solid #ede8e0; font-style:italic;">
            {note}
          </td>
        </tr>"""

    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Thông báo yêu cầu thiết bị — DeviceMS</title>
</head>
<body style="margin:0; padding:0; background:#f4f1eb; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0"
               style="background:#fbfaf7; border:1px solid #ded7ca;
                      border-radius:20px; overflow:hidden;
                      box-shadow:0 8px 32px rgba(29,37,40,0.10);">

          <!-- Header -->
          <tr>
            <td style="background:#315a58; padding:28px 36px;">
              <p style="margin:0; color:rgba(255,255,255,0.65); font-size:12px;
                         letter-spacing:0.08em; font-weight:700; text-transform:uppercase;">
                DeviceMS · Hệ thống quản lý thiết bị
              </p>
              <h1 style="margin:8px 0 0; color:#ffffff; font-size:22px;
                          font-weight:800; letter-spacing:-0.03em;">
                Kết quả xét duyệt yêu cầu
              </h1>
            </td>
          </tr>

          <!-- Decision badge -->
          <tr>
            <td style="padding:24px 36px 0;">
              <div style="display:inline-block; padding:10px 20px;
                           background:{decision_bg}; border-radius:999px;
                           color:{decision_color}; font-size:15px; font-weight:800;
                           letter-spacing:-0.01em;">
                {decision_label}
              </div>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:20px 36px 0;">
              <p style="margin:0; color:#1d2528; font-size:15px; line-height:1.7;">
                Xin chào <strong>{ho_ten}</strong>,
              </p>
              <p style="margin:10px 0 0; color:#64706f; font-size:14px; line-height:1.7;">
                {message}
              </p>
            </td>
          </tr>

          <!-- Details table -->
          <tr>
            <td style="padding:20px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-top:1px solid #ede8e0;">
                <tr>
                  <td style="padding:10px 0; color:#64706f; font-size:13px;
                               border-bottom:1px solid #ede8e0; width:140px;">
                    Mã yêu cầu
                  </td>
                  <td style="padding:10px 0; font-size:13px;
                               border-bottom:1px solid #ede8e0; font-weight:700;">
                    #{request_id}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0; color:#64706f; font-size:13px;
                               border-bottom:1px solid #ede8e0;">
                    Loại yêu cầu
                  </td>
                  <td style="padding:8px 0; font-size:13px; border-bottom:1px solid #ede8e0;">
                    {loai_label}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0; color:#64706f; font-size:13px;
                               border-bottom:1px solid #ede8e0;">
                    Thiết bị
                  </td>
                  <td style="padding:8px 0; font-size:13px; border-bottom:1px solid #ede8e0;">
                    {ten_thiet_bi or "—"}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0; color:#64706f; font-size:13px;
                               border-bottom:1px solid #ede8e0;">
                    Người duyệt
                  </td>
                  <td style="padding:8px 0; font-size:13px; border-bottom:1px solid #ede8e0;">
                    {reviewer}
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 0; color:#64706f; font-size:13px;
                               border-bottom:1px solid #ede8e0;">
                    Thời gian
                  </td>
                  <td style="padding:8px 0; font-size:13px; border-bottom:1px solid #ede8e0;">
                    {ngay_duyet}
                  </td>
                </tr>
                {note_row}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 36px 28px; border-top:1px solid #ede8e0;">
              <p style="margin:0; color:#8a918d; font-size:12px; line-height:1.6;">
                Email này được gửi tự động từ hệ thống <strong>DeviceMS</strong>.<br/>
                Vui lòng không trả lời email này.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _do_send(to_email: str, subject: str, html_body: str) -> None:
    """Hàm gửi thực sự — chạy trong thread riêng."""
    mail_user = os.getenv("MAIL_USERNAME", "")
    mail_pass = os.getenv("MAIL_PASSWORD", "")
    mail_from_name = os.getenv("MAIL_FROM_NAME", "DeviceMS System")

    if not mail_user or not mail_pass:
        print("[EmailService] Chưa cấu hình MAIL_USERNAME / MAIL_PASSWORD, bỏ qua.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{mail_from_name} <{mail_user}>"
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        print(f"[EmailService] Đang kết nối SMTP để gửi email tới {to_email}...")
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.login(mail_user, mail_pass)
            server.sendmail(mail_user, [to_email], msg.as_string())

        print(f"[EmailService] Đã gửi email tới {to_email} — {subject}")
    except Exception as exc:
        print(f"[EmailService] Lỗi gửi email tới {to_email}: {exc}")


def send_request_decision_email(
    to_email: str,
    ho_ten: str,
    request_id: int,
    loai_yeu_cau: str,
    ten_thiet_bi: str,
    decision: str,       # "approved" | "rejected"
    reviewer: str,
    note: str = "",
) -> None:
    """
    Gửi email thông báo kết quả yêu cầu cấp phát/thu hồi.
    Chạy bất đồng bộ (thread) — không block caller.
    """
    if not to_email or "@" not in to_email:
        print(f"[EmailService] Email không hợp lệ: {to_email!r}, bỏ qua.")
        return

    loai_label = _request_type_label(loai_yeu_cau)
    decision_word = "chấp nhận" if decision == "approved" else "từ chối"
    subject = f"[DeviceMS] Yêu cầu #{request_id} — {loai_label} đã được {decision_word}"
    ngay_duyet = datetime.now().strftime("%d/%m/%Y %H:%M")

    html_body = _build_html(
        ho_ten=ho_ten,
        request_id=request_id,
        loai_yeu_cau=loai_yeu_cau,
        ten_thiet_bi=ten_thiet_bi,
        decision=decision,
        reviewer=reviewer,
        note=note,
        ngay_duyet=ngay_duyet,
    )

    t = threading.Thread(
        target=_do_send,
        args=(to_email, subject, html_body),
        daemon=True,
    )
    t.start()
