from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

class Asset(TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    asset_type = models.CharField(max_length=100)
    status = models.CharField(max_length=50)
    criticality = models.CharField(max_length=50)
    purchase_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    location = models.ForeignKey("Location", null=True, blank=True, on_delete=models.SET_NULL, related_name="assets")
    service_components = models.ManyToManyField("ServiceComponent", blank=True, related_name="assets")

class AssetConfigurationItem(TimeStampedModel, TenantScopedModel):
    asset = models.ForeignKey(Asset, related_name="configuration_items", on_delete=models.CASCADE)
    key = models.CharField(max_length=100)
    value = models.CharField(max_length=255)

class AssetComplianceCertificate(TimeStampedModel, TenantScopedModel):
    asset = models.ForeignKey(Asset, related_name="compliance_certificates", on_delete=models.CASCADE)
    certificate_type = models.CharField(max_length=100)
    expiry_date = models.DateField()
    status = models.CharField(max_length=50)

class AssetCostTracking(TimeStampedModel, TenantScopedModel):
    asset = models.OneToOneField(Asset, related_name="cost_tracking", on_delete=models.CASCADE)
    monthly_operating_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    ytd_maintenance_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    insurance_annual = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
