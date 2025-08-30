from rest_framework import serializers
from ..models.workitems import (
    WorkItem, WorkItemCommunication, WorkItemVendorOrder, WorkItemChangeRelation
)
from ..models.analytics import FinancialImpact

class WorkItemCommunicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkItemCommunication
        fields = "__all__"

class WorkItemVendorOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkItemVendorOrder
        fields = "__all__"

class WorkItemChangeRelationSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkItemChangeRelation
        fields = "__all__"

class FinancialImpactSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialImpact
        fields = "__all__"

class WorkItemSerializer(serializers.ModelSerializer):
    communications = WorkItemCommunicationSerializer(many=True, read_only=True)
    vendor_orders = WorkItemVendorOrderSerializer(many=True, read_only=True)
    related_changes = WorkItemChangeRelationSerializer(many=True, read_only=True)
    financial_impact = FinancialImpactSerializer(read_only=True)

    class Meta:
        model = WorkItem
        fields = "__all__"
