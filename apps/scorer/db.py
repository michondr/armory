import psycopg
from psycopg.rows import dict_row

import config


def connect():
    return psycopg.connect(config.DATABASE_URL, autocommit=True, row_factory=dict_row)


def claim_job(conn):
    """Atomically claim one PENDING job (FOR UPDATE SKIP LOCKED). Returns row or None."""
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE scoring_jobs SET status='PROCESSING', attempts=attempts+1, "updatedAt"=now()
            WHERE id = (
              SELECT id FROM scoring_jobs WHERE status='PENDING'
              ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED
            )
            RETURNING id, "targetId"
            """
        )
        return cur.fetchone()


def load_target(conn, target_id):
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.id, t."imagePath", t."shotCount", t."scoringSystem", t."maxScorePerShot",
                   s."sessionId", ses."userId"
            FROM targets t
            JOIN shooting_sets s ON s.id = t."setId"
            JOIN sessions ses ON ses.id = s."sessionId"
            WHERE t.id = %s
            """,
            (target_id,),
        )
        return cur.fetchone()


def load_user(conn, user_id):
    with conn.cursor() as cur:
        cur.execute(
            'SELECT email, "smtpHost", "smtpPort", "smtpUser", "smtpPassEnc", "smtpFrom" '
            "FROM users WHERE id = %s",
            (user_id,),
        )
        return cur.fetchone()


def write_results(conn, target_id, shots, total_score):
    """Replace the target's shots with AI-detected ones and mark it SCORED."""
    with conn.transaction():
        with conn.cursor() as cur:
            cur.execute('DELETE FROM shots WHERE "targetId" = %s', (target_id,))
            for i, s in enumerate(shots):
                cur.execute(
                    """
                    INSERT INTO shots (id, "targetId", "index", "ringValue", x, y, zone, source, "createdAt")
                    VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, NULL, 'AI', now())
                    """,
                    (target_id, i, s["ring"], s["x"], s["y"]),
                )
            cur.execute(
                'UPDATE targets SET "totalScore"=%s, status=\'SCORED\', "shotCount"=%s, "updatedAt"=now() '
                "WHERE id=%s",
                (total_score, len(shots), target_id),
            )


def mark_job(conn, job_id, status, error=None):
    with conn.cursor() as cur:
        cur.execute(
            'UPDATE scoring_jobs SET status=%s, error=%s, "updatedAt"=now() WHERE id=%s',
            (status, error, job_id),
        )
