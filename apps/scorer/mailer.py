import base64
import smtplib
import ssl
from email.message import EmailMessage

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def decrypt_smtp_pass(payload_b64, key_hex):
    """Decrypt a password encrypted by the API (AES-256-GCM, layout iv|tag|ciphertext)."""
    key = bytes.fromhex(key_hex)
    raw = base64.b64decode(payload_b64)
    iv, tag, ct = raw[:12], raw[12:28], raw[28:]
    return AESGCM(key).decrypt(iv, ct + tag, None).decode("utf-8")


def send_scored_email(smtp, to_email, session_url):
    msg = EmailMessage()
    msg["Subject"] = "Your target has been scored"
    msg["From"] = smtp["from"]
    msg["To"] = to_email
    msg.set_content(
        "The app finished scoring your target from the photo.\n\n"
        f"Review the shots and approve or adjust them here:\n{session_url}\n"
    )

    port = int(smtp.get("port") or 587)
    host = smtp["host"]
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=ssl.create_default_context()) as s:
            _auth_send(s, smtp, msg)
    else:
        with smtplib.SMTP(host, port) as s:
            s.starttls(context=ssl.create_default_context())
            _auth_send(s, smtp, msg)


def _auth_send(s, smtp, msg):
    if smtp.get("user") and smtp.get("password"):
        s.login(smtp["user"], smtp["password"])
    s.send_message(msg)
