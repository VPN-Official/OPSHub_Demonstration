from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

import uuid
class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class Location(UUIDModel, TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    location_type = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    building = models.CharField(max_length=255, blank=True)
    floor = models.CharField(max_length=50, blank=True)
    capacity = models.IntegerField(null=True, blank=True)
    business_criticality = models.CharField(max_length=50, blank=True)

class Customer(UUIDModel, TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    locations = models.ManyToManyField(Location, blank=True, related_name="customers")

class CustomerEscalationContact(UUIDModel, TimeStampedModel, TenantScopedModel):
    customer = models.ForeignKey(Customer, related_name="escalation_contacts", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=100)
    email = models.EmailField()
