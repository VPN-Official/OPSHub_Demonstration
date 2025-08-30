from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .customers import Customer

class Contract(TimeStampedModel, TenantScopedModel):
    customer = models.ForeignKey(Customer, related_name="contracts", on_delete=models.CASCADE)
    title = models.CharField(max_length=255)
    valid_from = models.DateField()
    valid_to = models.DateField()

class SLATarget(TimeStampedModel, TenantScopedModel):
    contract = models.ForeignKey(Contract, related_name="sla_targets", on_delete=models.CASCADE)
    work_type = models.CharField(max_length=50)
    response_minutes = models.IntegerField()
    resolution_minutes = models.IntegerField()

class PenaltyClause(TimeStampedModel, TenantScopedModel):
    contract = models.ForeignKey(Contract, related_name="penalty_clauses", on_delete=models.CASCADE)
    condition = models.CharField(max_length=255)
    penalty_amount = models.DecimalField(max_digits=12, decimal_places=2)
    penalty_type = models.CharField(max_length=50)

class CostCenter(TimeStampedModel, TenantScopedModel):
    contract = models.ForeignKey(Contract, related_name="cost_centers", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    budget_amount = models.DecimalField(max_digits=12, decimal_places=2)
