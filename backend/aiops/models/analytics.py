from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .workitems import WorkItem

import uuid
class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class AnalyticsMetric(UUIDModel, TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=100)
    metric_type = models.CharField(max_length=50)
    value = models.FloatField()
    recorded_at = models.DateTimeField()

class FinancialImpact(UUIDModel, TimeStampedModel, TenantScopedModel):
    work_item = models.OneToOneField(WorkItem, related_name="financial_impact", on_delete=models.CASCADE)
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    actual_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    penalty_applied = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    revenue_loss = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    billable_hours = models.IntegerField(default=0)
