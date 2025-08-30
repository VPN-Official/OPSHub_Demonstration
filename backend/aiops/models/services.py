from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

import uuid
class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class BusinessService(UUIDModel, TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    criticality = models.CharField(max_length=50)
    revenue_impact_per_hour = models.DecimalField(max_digits=12, decimal_places=2)
    customers = models.ManyToManyField("Customer", blank=True, related_name="business_services")
    contracts = models.ManyToManyField("Contract", blank=True, related_name="business_services")
    cost_center = models.ForeignKey("CostCenter", null=True, blank=True, on_delete=models.SET_NULL, related_name="business_services")

class ServiceComplianceRequirement(UUIDModel, TimeStampedModel, TenantScopedModel):
    service = models.ForeignKey(BusinessService, related_name="compliance_requirements", on_delete=models.CASCADE)
    standard = models.CharField(max_length=100)
    description = models.TextField()

class ServiceComponent(UUIDModel, TimeStampedModel, TenantScopedModel):
    service = models.ForeignKey(BusinessService, related_name="components", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=50)
