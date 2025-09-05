from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

import uuid
class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class ExternalUser(UUIDModel, TimeStampedModel, TenantScopedModel):
    display_name = models.CharField(max_length=255)
    role = models.CharField(max_length=100)
    skills = models.JSONField(default=list, blank=True)
    certifications = models.JSONField(default=list, blank=True)

class Team(UUIDModel, TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    workload_summary = models.JSONField(default=dict, blank=True)

class TeamMembership(UUIDModel, TimeStampedModel, TenantScopedModel):
    team = models.ForeignKey(Team, related_name="memberships", on_delete=models.CASCADE)
    user = models.ForeignKey(ExternalUser, related_name="teams", on_delete=models.CASCADE)
    role = models.CharField(max_length=100, default="member")
