from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from datetime import date
import os

def send_reminder(to_email: str, subject: str, body: str):
    api_key = os.environ.get("SENDGRID_API_KEY", "")
    from_email = os.environ.get("ALERT_FROM_EMAIL", "")
    if not api_key or not to_email or not from_email:
        print(f"[Email skip] {to_email} | {subject}")
        return
    try:
        import sendgrid
        from sendgrid.helpers.mail import Mail
        sg = sendgrid.SendGridAPIClient(api_key=api_key)
        sg.send(Mail(from_email=from_email, to_emails=to_email, subject=subject, plain_text_content=body))
        print(f"[Email sent] {to_email} | {subject}")
    except Exception as e:
        print(f"[Email error] {e}")

def check_and_notify():
    from database import SessionLocal
    from models import Task, StatusEnum
    db: Session = SessionLocal()
    try:
        today = date.today()
        tasks = db.query(Task).filter(
            Task.status != StatusEnum.done,
            Task.due_date != None,
        ).all()
        for task in tasks:
            if not task.owner or not task.owner.email:
                continue
            days_left = (task.due_date - today).days
            # 提醒時機：7天、3天、1天、當天截止、逾期（每週一固定催）
            should_notify = (
                days_left in [7, 3, 1, 0] or
                (days_left < 0 and today.weekday() == 0)
            )
            if not should_notify:
                continue
            label = "已逾期" if days_left < 0 else (
                "今天截止" if days_left == 0 else f"剩 {days_left} 天"
            )
            subject = f"【任務提醒】{task.title}（{label}）"
            body = (
                f"{task.owner.name} 您好，\n\n"
                f"任務「{task.title}」截止日期：{task.due_date}（{label}）\n"
                f"目前狀態：{task.status}\n"
                + (f"卡關原因：{task.blocked_reason}\n" if task.blocked_reason else "")
                + f"\n請盡速更新進度。\n\n癌症醫院專案儀表板"
            )
            send_reminder(task.owner.email, subject, body)
    finally:
        db.close()

_scheduler = None

def start_scheduler():
    global _scheduler
    if _scheduler:
        return
    _scheduler = BackgroundScheduler(timezone="Asia/Taipei")
    _scheduler.add_job(check_and_notify, "cron", hour=8, minute=0)
    _scheduler.start()
    print("[Scheduler] 每日 08:00 逾期提醒已啟動")
