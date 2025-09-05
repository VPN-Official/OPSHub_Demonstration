from celery import shared_task
from django.utils.timezone import now
from django.db.models import Sum
from ..models.workitems import WorkItem
from ..models.analytics import AnalyticsMetric, FinancialImpact

@shared_task
def daily_rollup():
    """Aggregate MTTR, SLA compliance %, and daily cost impact."""
    today = now().date()
    closed_items = WorkItem.objects.filter(status="closed", modified_at__date=today)

    if closed_items.exists():
        mttr = sum([(wi.modified_at - wi.created_at).total_seconds() for wi in closed_items]) / len(closed_items) / 60
        AnalyticsMetric.objects.create(
            name="MTTR",
            metric_type="minutes",
            value=mttr,
            recorded_at=now()
        )

    total = closed_items.count()
    breaches = sum([1 for wi in closed_items if (wi.modified_at - wi.created_at).total_seconds()/60 > wi.sla_target_minutes])
    if total > 0:
        compliance = 100 * (total - breaches) / total
        AnalyticsMetric.objects.create(
            name="SLA_Compliance",
            metric_type="percent",
            value=compliance,
            recorded_at=now()
        )

    total_cost = FinancialImpact.objects.filter(work_item__in=closed_items).aggregate(total=Sum("actual_cost"))["total"]
    if total_cost:
        AnalyticsMetric.objects.create(
            name="Daily_Cost",
            metric_type="currency",
            value=float(total_cost),
            recorded_at=now()
        )
