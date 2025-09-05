from celery import shared_task
from ..models.workitems import WorkItem
from ..models.core import ExternalUser, Team

@shared_task
def notify_escalation(work_item_id, escalation_target):
    """Send escalation notifications (placeholder for email/Slack/etc)."""
    wi = WorkItem.objects.get(id=work_item_id)
    if escalation_target.startswith("team:"):
        team_id = escalation_target.split(":")[1]
        team = Team.objects.get(id=team_id)
        print(f"[ESCALATION] Team {team.name} notified for WorkItem {wi.title}")
    elif escalation_target.startswith("user:"):
        user_id = escalation_target.split(":")[1]
        user = ExternalUser.objects.get(id=user_id)
        print(f"[ESCALATION] User {user.display_name} notified for WorkItem {wi.title}")
    else:
        print(f"[ESCALATION] Unknown target {escalation_target} for WorkItem {wi.title}")
