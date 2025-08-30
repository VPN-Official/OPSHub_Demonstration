from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel

class Customer(TimeStampedModel, TenantScopedModel):
    name = models.CharField(max_length=255)

class CustomerEscalationContact(TimeStampedModel, TenantScopedModel):
    customer = models.ForeignKey(Customer, related_name="escalation_contacts", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=100)
    email = models.EmailField()
