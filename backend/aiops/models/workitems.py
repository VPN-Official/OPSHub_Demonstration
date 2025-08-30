from django.db import models
from .mixins import TimeStampedModel, TenantScopedModel
from .customers import Customer
from .services import BusinessService
from .assets import Asset
from .vendors import Vendor

class WorkItem(TimeStampedModel, TenantScopedModel):
    title = models.CharField(max_length=255)
    description = models.TextField()
    work_type = models.CharField(max_length=50)  # incident, request, problem
    status = models.CharField(max_length=50, default="new")
    priority = models.CharField(max_length=20)
    sla_target_minutes = models.IntegerField(default=60)
    business_service = models.ForeignKey(BusinessService, null=True, blank=True, on_delete=models.SET_NULL)
    asset = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL)
    vendor = models.ForeignKey(Vendor, null=True, blank=True, on_delete=models.SET_NULL)

class WorkItemCommunication(TimeStampedModel, TenantScopedModel):
    work_item = models.ForeignKey(WorkItem, related_name="communications", on_delete=models.CASCADE)
    message = models.TextField()
    sender = models.CharField(max_length=255)

class WorkItemVendorOrder(TimeStampedModel, TenantScopedModel):
    work_item = models.ForeignKey(WorkItem, related_name="vendor_orders", on_delete=models.CASCADE)
    vendor = models.ForeignKey(Vendor, on_delete=models.CASCADE)
    order_details = models.JSONField(default=dict)

class WorkItemChangeRelation(TimeStampedModel, TenantScopedModel):
    work_item = models.ForeignKey(WorkItem, related_name="related_changes", on_delete=models.CASCADE)
    change_request_id = models.UUIDField()
