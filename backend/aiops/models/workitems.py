from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .customers import Customer
from .services import BusinessService
from .assets import Asset
from .vendors import Vendor

import uuid
class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True

class WorkItem(UUIDModel, TimeStampedModel, TenantScopedModel):
    title = models.CharField(max_length=255)
    description = models.TextField()
    work_type = models.CharField(max_length=50)  # incident, request, problem
    status = models.CharField(max_length=50, default="new")
    priority = models.CharField(max_length=20)
    sla_target_minutes = models.IntegerField(default=60)
    business_service = models.ForeignKey(BusinessService, null=True, blank=True, on_delete=models.SET_NULL)
    location = models.CharField(max_length=100, blank=True, null=True)
    asset = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL)
    vendor = models.ForeignKey(Vendor, null=True, blank=True, on_delete=models.SET_NULL)    
    contract = models.ForeignKey("Contract", null=True, blank=True, on_delete=models.SET_NULL, related_name="work_items")
    customer = models.ForeignKey("Customer", null=True, blank=True, on_delete=models.SET_NULL, related_name="work_items")
    cost_center = models.ForeignKey("CostCenter", null=True, blank=True, on_delete=models.SET_NULL, related_name="work_items")
    operational_category = models.ForeignKey("OperationalCategory", null=True, blank=True, on_delete=models.SET_NULL, related_name="work_items")
    assigned_user = models.ForeignKey("ExternalUser", null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_work_items")
    assigned_team = models.ForeignKey("Team", null=True, blank=True, on_delete=models.SET_NULL, related_name="assigned_work_items")
    # Instead of single FK to asset, allow multiple if JSON requires
    related_assets = models.ManyToManyField("Asset", blank=True, related_name="related_work_items")


class WorkItemCommunication(UUIDModel, TimeStampedModel, TenantScopedModel):
    work_item = models.ForeignKey(WorkItem, related_name="communications", on_delete=models.CASCADE)
    message = models.TextField()
    sender = models.CharField(max_length=255)

class WorkItemVendorOrder(UUIDModel, TimeStampedModel, TenantScopedModel):
    work_item = models.ForeignKey(WorkItem, related_name="vendor_orders", on_delete=models.CASCADE)
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE)
    order_details = models.JSONField(default=dict)

class WorkItemChangeRelation(UUIDModel, TimeStampedModel, TenantScopedModel):
 work_item = models.ForeignKey(WorkItem, related_name="related_changes", on_delete=models.CASCADE)
 change_request = models.ForeignKey("ChangeRequest", null=True, blank=True, on_delete=models.SET_NULL)
