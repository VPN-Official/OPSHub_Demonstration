from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .workitems import WorkItem

class AnalyticsMetric(TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=100)
    metric_type = models.CharField(max_length=50)
    value = models.FloatField()
    recorded_at = models.DateTimeField()

class FinancialImpact(TimeStampedModel, TenantScopedModel):
    work_item = models.OneToOneField(WorkItem, related_name="financial_impact", on_delete=models.CASCADE)
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    actual_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    penalty_applied = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    revenue_loss = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    billable_hours = models.IntegerField(default=0)
