from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .customers import Customer

import uuid
class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class Contract(UUIDModel, TimeStampedModel, TenantScopedModel):
    customer = models.ForeignKey(Customer, related_name="contracts", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    valid_from = models.DateField()
    valid_to = models.DateField()

class SLATarget(UUIDModel, TimeStampedModel, TenantScopedModel):
    contract = models.ForeignKey(Contract, related_name="sla_targets", on_delete=models.CASCADE)
    work_type = models.CharField(max_length=50)
    response_minutes = models.IntegerField()
    resolution_minutes = models.IntegerField()

class PenaltyClause(UUIDModel, TimeStampedModel, TenantScopedModel):
    contract = models.ForeignKey(Contract, related_name="penalty_clauses", on_delete=models.CASCADE)
    condition = models.CharField(max_length=255)
    penalty_amount = models.DecimalField(max_digits=12, decimal_places=2)
    penalty_type = models.CharField(max_length=50)

class CostCenter(UUIDModel, TimeStampedModel, TenantScopedModel):
    contract = models.ForeignKey(Contract, related_name="cost_centers", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    budget_amount = models.DecimalField(max_digits=12, decimal_places=2)
