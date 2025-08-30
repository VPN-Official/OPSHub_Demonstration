from django.db import models
from django.utils.timezone import now

class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(default=now, editable=False)
    modified_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

class TenantScopedModel(models.Model):
    tenant_id = models.UUIDField(null=True, blank=True)

    class Meta:
        abstract = True
