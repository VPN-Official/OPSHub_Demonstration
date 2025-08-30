from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .services import BusinessService

class OperationalCategory(TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    sla_override = models.JSONField(default=dict, blank=True)
    notification_teams = models.JSONField(default=list, blank=True)

class ChangeRequest(TimeStampedModel, TenantScopedModel):
    title = models.CharField(max_length=255)
    description = models.TextField()
    scheduled_start = models.DateTimeField()
    scheduled_end = models.DateTimeField()
    related_services = models.ManyToManyField(BusinessService, blank=True)

class RiskRegister(TimeStampedModel, TenantScopedModel):
    service = models.ForeignKey(BusinessService, related_name="risks", on_delete=models.CASCADE)
    description = models.TextField()
    probability = models.CharField(max_length=20)  # low, medium, high
    impact = models.CharField(max_length=20)       # low, medium, high
    status = models.CharField(max_length=20, default="open")
    mitigation_plan = models.TextField(blank=True)
    owner = models.ForeignKey("ExternalUser", null=True, blank=True, on_delete=models.SET_NULL, related_name="owned_risks")
