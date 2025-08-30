from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

import uuid
class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class Vendor(UUIDModel, TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    certifications = models.JSONField(default=list, blank=True)
