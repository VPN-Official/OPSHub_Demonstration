from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

class BusinessService(TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    criticality = models.CharField(max_length=50)
    revenue_impact_per_hour = models.DecimalField(max_digits=12, decimal_places=2)

class ServiceComplianceRequirement(TimeStampedModel, TenantScopedModel):
    service = models.ForeignKey(BusinessService, related_name="compliance_requirements", on_delete=models.CASCADE)
    standard = models.CharField(max_length=100)
    description = models.TextField()

class ServiceComponent(TimeStampedModel, TenantScopedModel):
    service = models.ForeignKey(BusinessService, related_name="components", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50)
