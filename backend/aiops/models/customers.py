from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

class Location(TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    location_type = models.CharField(max_length=100, blank=True)
    address = models.TextField(blank=True)
    building = models.CharField(max_length=255, blank=True)
    floor = models.CharField(max_length=50, blank=True)
    capacity = models.IntegerField(null=True, blank=True)
    business_criticality = models.CharField(max_length=50, blank=True)

class Customer(TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)
    locations = models.ManyToManyField(Location, blank=True, related_name="customers")

class CustomerEscalationContact(TimeStampedModel, TenantScopedModel):
    customer = models.ForeignKey(Customer, related_name="escalation_contacts", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=100)
    email = models.EmailField()
