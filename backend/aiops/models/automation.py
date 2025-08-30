from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .workitems import WorkItem

import uuid
class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class AutomationRule(UUIDModel, TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    automation_type = models.CharField(max_length=50)  # remediation, notification
    status = models.CharField(max_length=20, default="active")

class AutomationTriggerCondition(UUIDModel, TimeStampedModel, TenantScopedModel):
    rule = models.ForeignKey(AutomationRule, related_name="trigger_conditions", on_delete=models.CASCADE)
    work_types = models.JSONField(default=list)
    asset_types = models.JSONField(default=list, blank=True)
    keywords = models.JSONField(default=list, blank=True)

class AutomationExecutionStep(UUIDModel, TimeStampedModel, TenantScopedModel):
    rule = models.ForeignKey(AutomationRule, related_name="execution_steps", on_delete=models.CASCADE)
    order = models.IntegerField()
    action = models.CharField(max_length=255)
    params = models.JSONField(default=dict)

class AutomationExecutionLog(UUIDModel, TimeStampedModel, TenantScopedModel):
    rule = models.ForeignKey(AutomationRule, related_name="logs", on_delete=models.CASCADE)
    work_item = models.ForeignKey(WorkItem, on_delete=models.CASCADE)
    status = models.CharField(max_length=50)
    message = models.CharField(max_length=500)    
    execution_time = models.FloatField()
    result = models.JSONField(default=dict)
