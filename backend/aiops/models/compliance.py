from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel


class ComplianceRecord(TimeStampedModel, TenantScopedModel):
    regulation = models.CharField(max_length=255)
    status = models.CharField(max_length=50, default="compliant")
    findings = models.JSONField(default=list, blank=True)
    corrective_actions = models.JSONField(default=list, blank=True)
    applicable_assets = models.ManyToManyField("Asset", blank=True, related_name="compliance_records")
    applicable_users = models.ManyToManyField("ExternalUser", blank=True, related_name="compliance_records")
    compliance_officer = models.ForeignKey("ExternalUser", null=True, blank=True, on_delete=models.SET_NULL, related_name="compliance_officer_records")
