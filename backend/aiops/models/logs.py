from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .assets import Asset
from .workitems import WorkItem

class SystemLog(TimeStampedModel, TenantScopedModel):
    timestamp = models.DateTimeField()
    level = models.CharField(max_length=20)
    source = models.CharField(max_length=255)
    category = models.CharField(max_length=50)
    message = models.TextField()
    asset = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL)
    work_item = models.ForeignKey(WorkItem, null=True, blank=True, on_delete=models.SET_NULL)
    tags = models.JSONField(default=list)

class SystemLogCorrelation(TimeStampedModel, TenantScopedModel):
    correlation_id = models.CharField(max_length=255)
    log = models.ForeignKey(SystemLog, related_name="correlations", on_delete=models.CASCADE)
