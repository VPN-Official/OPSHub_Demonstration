from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from ..models.workitems import WorkItem, WorkItemCommunication, WorkItemVendorOrder, WorkItemChangeRelation
from ..models.analytics import FinancialImpact
from ..serializers.workitems import (
    WorkItemSerializer, WorkItemCommunicationSerializer, WorkItemVendorOrderSerializer,
    WorkItemChangeRelationSerializer, FinancialImpactSerializer
)
from ..services.itsm_schema import validate_status, get_sla_target
from ..services.escalation import get_escalation_target
from ..services.impact import calculate_business_impact
from ..services.automation_engine import is_work_item_eligible_for_automation

class WorkItemViewSet(viewsets.ModelViewSet):
    queryset = WorkItem.objects.all()
    serializer_class = WorkItemSerializer

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        wi = self.get_object()
        new_status = request.data.get("status")
        if not validate_status(wi.work_type, new_status):
            return Response({"error": f"Invalid status {new_status} for {wi.work_type}"}, status=400)
        wi.status = new_status
        wi.save()
        return Response(WorkItemSerializer(wi).data)

    @action(detail=True, methods=["get"])
    def sla_target(self, request, pk=None):
        wi = self.get_object()
        target = get_sla_target(wi.work_type, wi.priority)
        return Response({"sla_minutes": target})

    @action(detail=True, methods=["get"])
    def impact(self, request, pk=None):
        wi = self.get_object()
        impact = calculate_business_impact(wi, duration_minutes=60)
        return Response(impact)

    @action(detail=True, methods=["get"])
    def escalation(self, request, pk=None):
        wi = self.get_object()
        elapsed = (wi.modified_at - wi.created_at).total_seconds() / 60
        target = get_escalation_target(wi.priority, wi.work_type, elapsed)
        return Response({"escalation_target": target})

    @action(detail=True, methods=["get"])
    def automation_eligibility(self, request, pk=None):
        wi = self.get_object()
        eligible_rules = []
        from ..models.automation import AutomationRule
        for rule in AutomationRule.objects.all():
            if is_work_item_eligible_for_automation(wi, rule):
                eligible_rules.append(rule.id)
        return Response({"eligible_rules": eligible_rules})
