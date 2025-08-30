from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

class Vendor(TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    certifications = models.JSONField(default=list, blank=True)
