from celery import shared_task
from django.utils.timezone import now
from ..models.workitems import WorkItem
from ..services.escalation import get_escalation_target

@shared_task
def run_sla_checks():
    """Check open WorkItems against SLA and trigger escalations."""
    workitems = WorkItem.objects.filter(status__in=["new", "in_progress"])
    alerts = []
    for wi in workitems:
        elapsed_minutes = (now() - wi.created_at).total_seconds() / 60
        sla_minutes = wi.sla_target_minutes
        if elapsed_minutes > sla_minutes:
            target = get_escalation_target(wi.priority, wi.work_type, elapsed_minutes)
            alerts.append({
                "work_item": wi.id,
                "title": wi.title,
                "escalation_target": target,
                "elapsed_minutes": elapsed_minutes
            })
            # TODO: enqueue escalation notification
    return alerts
