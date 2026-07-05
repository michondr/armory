import os
import time
import traceback

import config
import db
import mailer
import vision


def _log(msg):
    print(f"[scorer] {msg}", flush=True)


def _notify(conn, target):
    """Best-effort email to the target's owner that scoring finished."""
    user = db.load_user(conn, target["userId"])
    if not user or not user["smtpHost"]:
        return
    try:
        password = ""
        if user["smtpPassEnc"] and config.APP_ENCRYPTION_KEY:
            password = mailer.decrypt_smtp_pass(user["smtpPassEnc"], config.APP_ENCRYPTION_KEY)
        smtp = {
            "host": user["smtpHost"],
            "port": user["smtpPort"],
            "user": user["smtpUser"],
            "password": password,
            "from": user["smtpFrom"] or user["email"],
        }
        url = f"https://{config.ARMORY_DOMAIN}/sessions/{target['sessionId']}"
        mailer.send_scored_email(smtp, user["email"], url)
        _log(f"emailed {user['email']}")
    except Exception as e:  # email must never fail the job
        _log(f"email failed: {e}")


def process_one(conn):
    job = db.claim_job(conn)
    if not job:
        return False
    job_id, target_id = job["id"], job["targetId"]
    _log(f"job {job_id} target {target_id}")
    try:
        target = db.load_target(conn, target_id)
        if not target or not target["imagePath"]:
            db.mark_job(conn, job_id, "FAILED", "target has no image")
            return True
        path = os.path.join(config.IMAGES_DIR, str(target["userId"]), target["imagePath"])
        max_score = target["maxScorePerShot"] or 10
        result = vision.score_image(path, target["shotCount"], max_score)
        db.write_results(conn, target_id, result["shots"], result["total"])
        db.mark_job(conn, job_id, "DONE")
        _log(f"scored {len(result['shots'])} shots, total {result['total']}")
        _notify(conn, target)
    except Exception as e:
        db.mark_job(conn, job_id, "FAILED", str(e)[:500])
        _log(f"job {job_id} failed: {e}")
        traceback.print_exc()
    return True


def main():
    _log("starting")
    conn = None
    while True:
        try:
            if conn is None or conn.closed:
                conn = db.connect()
                _log("connected to db")
            worked = process_one(conn)
            if not worked:
                time.sleep(config.POLL_INTERVAL)
        except Exception as e:
            _log(f"loop error: {e}")
            traceback.print_exc()
            try:
                if conn:
                    conn.close()
            except Exception:
                pass
            conn = None
            time.sleep(config.POLL_INTERVAL)


if __name__ == "__main__":
    main()
